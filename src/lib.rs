use anchor_lang::prelude::*;
use anchor_spl::token::{
    self, FreezeAccount, Mint, MintTo, ThawAccount, Token, TokenAccount, Transfer,
};

declare_id!("AUWtLgwXV2wxFoKRHo5NTiDW15q867ynR2Stky81JhT9");

#[program]
pub mod dopamine_escrow {
    use super::*;

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        amount: u64,
    ) -> Result<()> {
        ctx.accounts.escrow_account.initializer = ctx.accounts.initializer.key();
        ctx.accounts.escrow_account.verifier = ctx.accounts.verifier.key();
        ctx.accounts.escrow_account.doubter = Pubkey::default();
        ctx.accounts.escrow_account.amount = amount;
        ctx.accounts.escrow_account.counter_amount = 0;
        ctx.accounts.escrow_account.is_completed = false;
        ctx.accounts.escrow_account.bump = ctx.bumps.escrow_account;

        let cpi_accounts = Transfer {
            from: ctx.accounts.initializer_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.initializer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        Ok(())
    }

    pub fn fund_counter_pool(
        ctx: Context<FundCounterPool>,
        counter_amount: u64,
    ) -> Result<()> {
        require!(
            !ctx.accounts.escrow_account.is_completed,
            EscrowError::AlreadyCompleted
        );

        let cpi_accounts = Transfer {
            from: ctx.accounts.doubter_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.doubter.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, counter_amount)?;

        ctx.accounts.escrow_account.doubter = ctx.accounts.doubter.key();
        ctx.accounts.escrow_account.counter_amount = ctx
            .accounts
            .escrow_account
            .counter_amount
            .checked_add(counter_amount)
            .unwrap();

        Ok(())
    }

    pub fn complete_action(ctx: Context<CompleteAction>) -> Result<()> {
        require!(
            !ctx.accounts.escrow_account.is_completed,
            EscrowError::AlreadyCompleted
        );
        require!(
            ctx.accounts.verifier.key() == ctx.accounts.escrow_account.verifier,
            EscrowError::UnauthorizedVerifier
        );

        let initializer_key = ctx.accounts.escrow_account.initializer;
        let bump = ctx.accounts.escrow_account.bump;
        let total_payout = ctx
            .accounts
            .escrow_account
            .amount
            .checked_add(ctx.accounts.escrow_account.counter_amount)
            .unwrap();

        let seeds = &[b"escrow".as_ref(), initializer_key.as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.initializer_token_account.to_account_info(),
            authority: ctx.accounts.escrow_account.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, total_payout)?;

        let motiv_bump = ctx.bumps.motiv_authority;
        let motiv_seeds = &[b"motiv_authority".as_ref(), &[motiv_bump]];
        let motiv_signer = &[&motiv_seeds[..]];

        if ctx.accounts.initializer_motiv_account.is_frozen() {
            let thaw_accounts = ThawAccount {
                account: ctx.accounts.initializer_motiv_account.to_account_info(),
                mint: ctx.accounts.motiv_mint.to_account_info(),
                authority: ctx.accounts.motiv_authority.to_account_info(),
            };
            let thaw_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                thaw_accounts,
                motiv_signer,
            );
            token::thaw_account(thaw_ctx)?;
        }

        let motiv_reward: u64 = 1_000_000;
        let mint_accounts = MintTo {
            mint: ctx.accounts.motiv_mint.to_account_info(),
            to: ctx.accounts.initializer_motiv_account.to_account_info(),
            authority: ctx.accounts.motiv_authority.to_account_info(),
        };
        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            mint_accounts,
            motiv_signer,
        );
        token::mint_to(mint_ctx, motiv_reward)?;

        let freeze_accounts = FreezeAccount {
            account: ctx.accounts.initializer_motiv_account.to_account_info(),
            mint: ctx.accounts.motiv_mint.to_account_info(),
            authority: ctx.accounts.motiv_authority.to_account_info(),
        };
        let freeze_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            freeze_accounts,
            motiv_signer,
        );
        token::freeze_account(freeze_ctx)?;

        ctx.accounts.escrow_account.is_completed = true;

        Ok(())
    }

    pub fn fail_action(ctx: Context<FailAction>) -> Result<()> {
        require!(
            !ctx.accounts.escrow_account.is_completed,
            EscrowError::AlreadyCompleted
        );
        require!(
            ctx.accounts.verifier.key() == ctx.accounts.escrow_account.verifier,
            EscrowError::UnauthorizedVerifier
        );

        let initializer_key = ctx.accounts.escrow_account.initializer;
        let bump = ctx.accounts.escrow_account.bump;
        let total_payout = ctx
            .accounts
            .escrow_account
            .amount
            .checked_add(ctx.accounts.escrow_account.counter_amount)
            .unwrap();

        let seeds = &[b"escrow".as_ref(), initializer_key.as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.doubter_token_account.to_account_info(),
            authority: ctx.accounts.escrow_account.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, total_payout)?;

        ctx.accounts.escrow_account.is_completed = true;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    /// CHECK: Verifier authority
    pub verifier: AccountInfo<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = initializer,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 1 + 1,
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
pub struct FundCounterPool<'info> {
    #[account(mut)]
    pub doubter: Signer<'info>,
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
    pub doubter_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
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
    #[account(mut)]
    pub motiv_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = initializer_motiv_account.owner == escrow_account.initializer,
        constraint = initializer_motiv_account.mint == motiv_mint.key()
    )]
    pub initializer_motiv_account: Account<'info, TokenAccount>,
    /// CHECK: Global PDA authority for minting and freezing Soulbound MOTIV
    #[account(
        seeds = [b"motiv_authority"],
        bump
    )]
    pub motiv_authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FailAction<'info> {
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
    #[account(
        mut,
        constraint = doubter_token_account.owner == escrow_account.doubter
    )]
    pub doubter_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct EscrowAccount {
    pub initializer: Pubkey,
    pub verifier: Pubkey,
    pub doubter: Pubkey,
    pub amount: u64,
    pub counter_amount: u64,
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
