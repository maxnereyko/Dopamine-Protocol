import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = pg.program;
  const connection = provider.connection;
  const payer = pg.wallet.keypair;

  console.log("Running Dual Pools and Soulbound MOTIV test...");

  const initializer = web3.Keypair.generate();
  const doubter = web3.Keypair.generate();
  const verifier = web3.Keypair.generate();

  // 1. Fund participant and doubter wallets with Devnet SOL for transaction fees
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

  // 2. Create stake token mint and Soulbound MOTIV reputation mint
  const mint = await splToken.createMint(connection, payer, payer.publicKey, null, 6, undefined, { commitment: "confirmed" });

  const [motivAuthorityPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("motiv_authority")],
    program.programId
  );

  const motivMint = await splToken.createMint(connection, payer, motivAuthorityPda, motivAuthorityPda, 6, undefined, { commitment: "confirmed" });

  const initializerTokenAccount = await splToken.createAccount(connection, payer, mint, initializer.publicKey, undefined, { commitment: "confirmed" });
  const doubterTokenAccount = await splToken.createAccount(connection, payer, mint, doubter.publicKey, undefined, { commitment: "confirmed" });
  const initializerMotivAccount = await splToken.createAccount(connection, payer, motivMint, initializer.publicKey, undefined, { commitment: "confirmed" });

  const stakeAmount = 100_000_000; // 100 tokens
  const counterAmount = 50_000_000; // 50 tokens

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

  // 3. Initialize escrow with user stake (100 tokens)
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

  // 4. Doubter funds the counter-pool (50 tokens)
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

  // 5. Verifier confirms completion: winner claims 150 tokens + 1 Soulbound MOTIV
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
    })
    .signers([verifier])
    .rpc({ commitment: "confirmed" });
  console.log("Action completed, pool paid and MOTIV minted:", completeTx);

  const winnerBalance = await connection.getTokenAccountBalance(initializerTokenAccount, "confirmed");
  const motivBalance = await connection.getTokenAccountBalance(initializerMotivAccount, "confirmed");

  console.log(`Success! Winner balance: ${winnerBalance.value.uiAmount} tokens | MOTIV: ${motivBalance.value.uiAmount}`);
}

main().catch(console.error);
