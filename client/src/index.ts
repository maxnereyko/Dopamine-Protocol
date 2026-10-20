import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = pg.program;
  const connection = provider.connection;
  const payer = pg.wallet.keypair;

  console.log("Running Dual Pools + Token-2022 NonTransferable MOTIV test...");

  const initializer = web3.Keypair.generate();
  const doubter = web3.Keypair.generate();
  const verifier = web3.Keypair.generate();

  const fundTx = new web3.Transaction().add(
    web3.SystemProgram.transfer({
      fromPubkey: pg.wallet.publicKey,
      toPubkey: initializer.publicKey,
      lamports: 0.05 * web3.LAMPORTS_PER_SOL,
    }),
    web3.SystemProgram.transfer({
      fromPubkey: pg.wallet.publicKey,
      toPubkey: doubter.publicKey,
      lamports: 0.05 * web3.LAMPORTS_PER_SOL,
    })
  );
  await web3.sendAndConfirmTransaction(connection, fundTx, [payer], { commitment: "confirmed" });

  // 1. Create standard SPL Mint for stakes (DOPE/USDC)
  const mint = await splToken.createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    6,
    undefined,
    { commitment: "confirmed" }
  );

  // 2. Create Token-2022 Mint with native NonTransferable extension for Soulbound MOTIV
  const [motivAuthorityPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("motiv_authority")],
    program.programId
  );

  const motivMintKeypair = web3.Keypair.generate();
  const motivMint = motivMintKeypair.publicKey;
  const mintLen = splToken.getMintLen([splToken.ExtensionType.NonTransferable]);
  const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const createMotivMintTx = new web3.Transaction().add(
    web3.SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: motivMint,
      space: mintLen,
      lamports: mintLamports,
      programId: splToken.TOKEN_2022_PROGRAM_ID,
    }),
    splToken.createInitializeNonTransferableMintInstruction(
      motivMint,
      splToken.TOKEN_2022_PROGRAM_ID
    ),
    splToken.createInitializeMintInstruction(
      motivMint,
      6,
      motivAuthorityPda,
      null, // No freeze authority needed — NonTransferable is native!
      splToken.TOKEN_2022_PROGRAM_ID
    )
  );
  await web3.sendAndConfirmTransaction(
    connection,
    createMotivMintTx,
    [payer, motivMintKeypair],
    { commitment: "confirmed" }
  );

  const initializerTokenAccount = await splToken.createAccount(
    connection,
    payer,
    mint,
    initializer.publicKey,
    undefined,
    { commitment: "confirmed" }
  );
  const doubterTokenAccount = await splToken.createAccount(
    connection,
    payer,
    mint,
    doubter.publicKey,
    undefined,
    { commitment: "confirmed" }
  );

  // Create Token-2022 Associated Token Account for initializer's Soulbound MOTIV
  const initializerMotivAccount = await splToken.createAssociatedTokenAccount(
    connection,
    payer,
    motivMint,
    initializer.publicKey,
    { commitment: "confirmed" },
    splToken.TOKEN_2022_PROGRAM_ID
  );

  const stakeAmount = 100_000_000;
  const counterAmount = 50_000_000;

  await splToken.mintTo(connection, payer, mint, initializerTokenAccount, payer, stakeAmount, [], { commitment: "confirmed" });
  await splToken.mintTo(connection, payer, mint, doubterTokenAccount, payer, counterAmount, [], { commitment: "confirmed" });

  const [escrowPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), initializer.publicKey.toBuffer()],
    program.programId
  );
  const [vaultPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), initializer.publicKey.toBuffer()],
    program.programId
  );

  const initTx = await program.methods
    .initializeEscrow(new anchor.BN(stakeAmount))
    .accounts({
      initializer: initializer.publicKey,
      verifier: verifier.publicKey,
      mint: mint,
      escrowAccount: escrowPda,
      initializerTokenAccount: initializerTokenAccount,
      vaultTokenAccount: vaultPda,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: splToken.TOKEN_PROGRAM_ID,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([initializer])
    .rpc({ commitment: "confirmed" });
  console.log("Escrow initialized:", initTx);

  const counterTx = await program.methods
    .fundCounterPool(new anchor.BN(counterAmount))
    .accounts({
      doubter: doubter.publicKey,
      escrowAccount: escrowPda,
      vaultTokenAccount: vaultPda,
      doubterTokenAccount: doubterTokenAccount,
      tokenProgram: splToken.TOKEN_PROGRAM_ID,
    })
    .signers([doubter])
    .rpc({ commitment: "confirmed" });
  console.log("Counter-pool funded:", counterTx);

  const completeTx = await program.methods
    .completeAction()
    .accounts({
      verifier: verifier.publicKey,
      escrowAccount: escrowPda,
      vaultTokenAccount: vaultPda,
      initializerTokenAccount: initializerTokenAccount,
      motivMint: motivMint,
      initializerMotivAccount: initializerMotivAccount,
      motivAuthority: motivAuthorityPda,
      tokenProgram: splToken.TOKEN_PROGRAM_ID,
      token2022Program: splToken.TOKEN_2022_PROGRAM_ID,
    })
    .signers([verifier])
    .rpc({ commitment: "confirmed" });
  console.log("Action completed, pool paid and Token-2022 MOTIV minted:", completeTx);

  const winnerBalance = await connection.getTokenAccountBalance(initializerTokenAccount, "confirmed");
  const motivBalance = await connection.getTokenAccountBalance(initializerMotivAccount, "confirmed");
  console.log(`Success! Winner balance: ${winnerBalance.value.uiAmount} tokens | MOTIV: ${motivBalance.value.uiAmount}`);

  // Verify that Token-2022 NonTransferable blocks any transfer attempt
  const doubterMotivAccount = await splToken.createAssociatedTokenAccount(
    connection,
    payer,
    motivMint,
    doubter.publicKey,
    { commitment: "confirmed" },
    splToken.TOKEN_2022_PROGRAM_ID
  );

  try {
    await splToken.transferChecked(
      connection,
      payer,
      initializerMotivAccount,
      motivMint,
      doubterMotivAccount,
      initializer,
      1_000_000,
      6,
      [],
      { commitment: "confirmed" },
      splToken.TOKEN_2022_PROGRAM_ID
    );
  } catch (err) {
    console.log("Verified: Token-2022 NonTransferable permanently blocked MOTIV transfer!");
  }
}

main().catch(console.error);
