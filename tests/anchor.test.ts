import * as splToken from "@solana/spl-token";

describe("dopamine_escrow", () => {
  it("Initializes escrow and completes action with token transfers", async () => {
    const program = pg.program;
    const connection = pg.connection;
    const payer = pg.wallet.keypair;

    const initializer = web3.Keypair.generate();
    const verifier = web3.Keypair.generate();

    // 1. Переводим 0.05 SOL участнику и ждем подтверждения блока
    const fundTx = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: pg.wallet.publicKey,
        toPubkey: initializer.publicKey,
        lamports: 0.05 * web3.LAMPORTS_PER_SOL,
      })
    );
    await web3.sendAndConfirmTransaction(connection, fundTx, [payer], {
      commitment: "confirmed",
    });

    // 2. Создаем тестовый токен и чеканим 100 токенов участнику
    const mint = await splToken.createMint(
      connection,
      payer,
      payer.publicKey,
      null,
      6,
      undefined,
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

    const stakeAmount = 100_000_000; // 100 токенов
    await splToken.mintTo(
      connection,
      payer,
      mint,
      initializerTokenAccount,
      payer,
      stakeAmount,
      [],
      { commitment: "confirmed" }
    );

    // 3. Вычисляем адреса PDA для эскроу и сейфа (vault)
    const [escrowPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), initializer.publicKey.toBuffer()],
      program.programId
    );

    const [vaultPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), initializer.publicKey.toBuffer()],
      program.programId
    );

    console.log("Testing initialize_escrow...");

    // 4. Вызываем initialize_escrow и ждем подтверждения в Devnet
    const initTx = await program.methods
      .initializeEscrow(new BN(stakeAmount))
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

    await connection.confirmTransaction(initTx, "confirmed");
    console.log("initialize_escrow tx:", initTx);

    // Проверяем баланс сейфа на уровне "confirmed"
    const vaultBalanceAfterInit = await connection.getTokenAccountBalance(
      vaultPda,
      "confirmed"
    );
    assert.equal(
      vaultBalanceAfterInit.value.amount,
      stakeAmount.toString(),
      "Tokens should be locked in vault"
    );

    console.log("Locked in vault:", vaultBalanceAfterInit.value.uiAmount, "tokens");
    console.log("Testing complete_action...");

    // 5. Вызываем complete_action и ждем подтверждения в Devnet
    const completeTx = await program.methods
      .completeAction()
      .accounts({
        verifier: verifier.publicKey,
        escrowAccount: escrowPda,
        vaultTokenAccount: vaultPda,
        initializerTokenAccount: initializerTokenAccount,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
      })
      .signers([verifier])
      .rpc({ commitment: "confirmed" });

    await connection.confirmTransaction(completeTx, "confirmed");
    console.log("complete_action tx:", completeTx);

    // 6. Проверяем возврат токенов и статус контракта
    const userBalanceAfterComplete = await connection.getTokenAccountBalance(
      initializerTokenAccount,
      "confirmed"
    );
    const escrowState = await program.account.escrowAccount.fetch(
      escrowPda,
      "confirmed"
    );

    assert.equal(
      userBalanceAfterComplete.value.amount,
      stakeAmount.toString(),
      "Tokens should be returned to initializer"
    );
    assert.equal(escrowState.isCompleted, true, "Escrow should be marked completed");

    console.log(
      "Success! Returned to user:",
      userBalanceAfterComplete.value.uiAmount,
      "tokens"
    );
  });
});
