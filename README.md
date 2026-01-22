<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/18hbAMqO81swe6Bx9yE3bm6wkPPhyKMC_

## 协作者推送代码

若 `git push` 报 `Invalid username or token` / `Password authentication is not supported`，说明不能用账号密码推送。请按 [docs/GITHUB_PUSH.md](docs/GITHUB_PUSH.md) 配置 **Personal Access Token** 或 **SSH** 后再推送。

---

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
