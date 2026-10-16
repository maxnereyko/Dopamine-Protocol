 use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("AUWtLgwXV2wxFoKRHo5NTiDW15q867ynR2Stky81JhT9");

#[program]
pub mod dopamine_escrow {
    use super::*;

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        amount: u64,
    ) -> Result<()> {
        let escrow_account = &mut ctx.accounts.escrow_account;
        escrow_account.initializer = ctx.accounts.initializer.key();
        escrow_account.verifier = ctx.accounts.verifier.key();
        escrow_account.amount = amount;
        escrow_account.is_completed = false;
        escrow_account.bump = ctx.bumps.escrow_account;

        let cpi_accounts = Transfer {
            from: ctx.accounts.initializer_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.initializer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        msg!("Dopamine Escrow initialized: {} tokens locked.", amount);
        Ok(())
    }

    pub fn complete_action(ctx: Context<CompleteAction>) -> Result<()> {
        require!(
            !ctx.accounts.escrow_account.is_completed,
            EscrowError::AlreadyCompleted
        );
        require_keys_eq!(
            ctx.accounts.verifier.key(),
            ctx.accounts.escrow_account.verifier,
            EscrowError::UnauthorizedVerifier
        );

        ctx.accounts.escrow_account.is_completed = true;

        let initializer_key = ctx.accounts.escrow_account.initializer;
        let amount = ctx.accounts.escrow_account.amount;
        let bump = ctx.accounts.escrow_account.bump;

        let seeds = &[
            b"escrow",
            initializer_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.initializer_token_account.to_account_info(),
            authority: ctx.accounts.escrow_account.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::transfer(cpi_ctx, amount)?;

        msg!("Proof-of-Action verified! Escrow tokens released.");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    /// CHECK: Designated verifier or oracle authority for Proof-of-Action
    pub verifier: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = initializer,
        space = 8 + 32 + 32 + 8 + 1 + 1,
        seeds = [b"escrow", initializer.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    #[account(
        mut,
        constraint = initializer_token_account.owner == initializer.key(),
        constraint = initializer_token_account.mint == mint.key()
    )]
    pub initializer_token_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = initializer,
        token::mint = mint,
        token::authority = escrow_account,
        seeds = [b"vault", initializer.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CompleteAction<'info> {
    pub verifier: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", escrow_account.initializer.as_ref()],
        bump = escrow_account.bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    #[account(
        mut,
        seeds = [b"vault", escrow_account.initializer.as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub initializer_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct EscrowAccount {
    pub initializer: Pubkey,
    pub verifier: Pubkey,
    pub amount: u64,
    pub is_completed: bool,
    pub bump: u8,
}

#[error_code]
pub enum EscrowError {
    #[msg("This Proof-of-Action escrow has already been completed.")]
    AlreadyCompleted,
    #[msg("Unauthorized verifier signature.")]
    UnauthorizedVerifier,
}
