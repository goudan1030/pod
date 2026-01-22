# 协作者推送代码到 GitHub 指南

如果你 `git push` 时出现：

```
remote: Invalid username or token.
Password authentication is not supported for Git operations.
fatal: Authentication failed for 'https://github.com/...'
```

说明 GitHub 已不再支持用**账号密码**推送，必须改用 **Personal Access Token（PAT）** 或 **SSH**。

---

## 方式一：HTTPS + Personal Access Token（推荐）

### 1. 创建 Token

1. 登录 GitHub → 右上角头像 → **Settings**
2. 左侧最底部 **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. **Generate new token (classic)**，Note 随便填（如 `pod 项目`）
4. 勾选 **repo**
5. 生成后**立即复制 token**（只显示一次）

### 2. 用 Token 推送

```bash
git push origin main
```

- **Username**：填你的 **GitHub 用户名**（不是邮箱）
- **Password**：粘贴刚复制的 **Token**（不要填登录密码）

### 3. 让 Git 记住凭据（可选，避免每次输入）

```bash
git config --global credential.helper osxkeychain
```

首次输入用户名 + Token 后，之后会存在钥匙串里。

---

## 方式二：改用 SSH

### 1. 生成 SSH 密钥

```bash
ssh-keygen -t ed25519 -C "你的邮箱@example.com"
```

一路回车即可。

### 2. 把公钥加到 GitHub

```bash
cat ~/.ssh/id_ed25519.pub
```

复制整行 → GitHub → **Settings** → **SSH and GPG keys** → **New SSH key** → 粘贴保存。

### 3. 把远程改成 SSH 地址

```bash
git remote set-url origin git@github.com:goudan1030/pod.git
git remote -v
```

### 4. 推送

```bash
git push origin main
```

不再需要输入密码。

---

## 检查当前配置

```bash
git config user.name
git config user.email
git remote -v
```

- `user.name` / `user.email` 随便设，只影响提交记录里的作者信息
- `remote -v` 里是 `https://...` 用方式一，是 `git@github.com:...` 用方式二

---

有任何问题找项目负责人。
