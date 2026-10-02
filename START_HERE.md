# Open Kora in VS Code, build, and deploy to Vercel

This archive contains the complete source. Extract it into a normal folder and open the folder containing **package.json** in VS Code. The files are at the archive root; there is no extra `kora-shop` folder to enter. Use this updated source instead of the earlier download.

## 1. Install the tools

Install Node.js **24 LTS** and Git, then reopen VS Code so its terminal sees them. The project supports Node 22 or newer; this release was verified with Node 24.19.0. Install the pinned package manager once:

```powershell
node --version
npm.cmd install -g pnpm@11.25.0
pnpm.cmd --version
```

The `.cmd` commands work in PowerShell without requiring a script execution-policy change. On macOS/Linux, use `npm` and `pnpm` instead. The included `.nvmrc` selects Node 24 when using nvm.

Accept VS Code's prompt to use the workspace TypeScript version. The recommended Tailwind CSS extension improves autocomplete; the app builds without installing an editor extension.

## 2. Install and run locally

Run these in the folder containing package.json:

```powershell
pnpm.cmd install --frozen-lockfile
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
pnpm.cmd dev
```

Open **http://localhost:3000**. The supplied configuration starts in demo mode, so you can inspect the store without service keys. Demo purchases take no payment and send no order email. Keep `pnpm-lock.yaml` and `pnpm-workspace.yaml`; they make installations reproducible and allow only the required native build scripts. Use pnpm throughout this project.

For macOS/Linux, create the local environment file only if absent:

```bash
test -f .env.local || cp .env.example .env.local
pnpm dev
```

## 3. Check the production build

Stop the development server with Ctrl+C, then run:

```powershell
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd start
```

The last command runs the production build at http://localhost:3000. `pnpm dev` runs the development server. Do not run both on the same port. `pnpm build` uses Next.js with Webpack; `build:artifact` is for the optional Sites/Cloudflare adapter and is not the Vercel build command.

See **QA.md** for the checks performed on this release. Browser checks here used Chromium on Linux; Windows and physical phone verification should be performed on your own devices.

## 4. Push a fresh extracted copy to GitHub

Create an empty GitHub repository without an initial README, then run the following. Replace the example GitHub URL with your own repository URL:

```powershell
git init
git branch -M main
git add .
git status --short
git commit -m "Initial Kora storefront"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

The archive does not contain Git history, installed modules, build output or private environment files. `.gitignore` excludes `.env.local`, generated output and Vercel's local project files. Keep service secrets in `.env.local` and the Vercel dashboard.

## 5. Import the repository into Vercel

Choose **Next.js** as the framework and the directory containing package.json as the root. If you put the app at the repository root, leave Root Directory at its default. Leave Output Directory at the framework default.

The included **vercel.json** runs these commands using exactly the tested pnpm version:

```text
Install: npx --yes pnpm@11.25.0 install --frozen-lockfile
Build:   npx --yes pnpm@11.25.0 build
```

This avoids relying on Vercel's automatic selection of an older pnpm version. Use Node 24 for the deployment. For an initial demo deployment, set `APP_MODE=demo`. After Vercel assigns your store's HTTPS domain, set `APP_URL` and `NEXTAUTH_URL` to that origin and redeploy.

## 6. Activate the real services

Set the server environment variables listed in **.env.example** in Vercel and locally. Generate a stable authentication secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put that output in `NEXTAUTH_SECRET`. Use your actual Vercel/custom domain in **LIVE_SETUP.md**; the document lists the Google and Paystack callback paths. All keys remain server-side; they do not need a `NEXT_PUBLIC_` prefix.

With the target Neon connection configured, apply the committed migrations and optional sample catalog once:

```powershell
pnpm.cmd db:migrate
pnpm.cmd db:seed
```

Use `APP_MODE=live` with Paystack **test** credentials to check Google sign-in, account cart persistence, payment verification, receipts and owner delivery updates. Real Mailgun sends require its configured domain and an authorized owner session. Validate the providers before accepting live customer payments. Configure the maintenance scheduler described in README.md for reservation cleanup and email retries.

## Common startup problems

| Problem | What to check |
| --- | --- |
| `pnpm` is not recognized | Install pnpm 11.25.0 and reopen the VS Code terminal; use `pnpm.cmd` in PowerShell. |
| Lockfile/configuration mismatch | Use this archive's package.json, lockfile and workspace settings together; run the pinned pnpm version. |
| Port 3000 is already in use | Stop the other dev/start process. For a different port, also update APP_URL and NEXTAUTH_URL. |
| Changes do not appear | Stop the server, rebuild with `pnpm build`, then run `pnpm start`, or use `pnpm dev` while editing. |
| Database/configuration recovery screen | Check APP_MODE and DATABASE_URL. Use demo mode until the target live database is configured and migrated. |
| Auth server configuration error or `NO_SECRET` | Set NEXTAUTH_SECRET, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel's Production environment, then redeploy. Generate a strong, stable secret using the command above. Guest sessions and database carts work while Google setup is incomplete; login remains unavailable. |
| Google redirect error | The Google Web client must allow your exact `/api/auth/callback/google` URL; check the client ID, secret and NEXTAUTH_URL. |
| Vercel build uses the wrong pnpm | Retain vercel.json and avoid replacing its install command with a plain `pnpm install` override. |

Official hosting guidance: https://vercel.com/docs/package-managers
