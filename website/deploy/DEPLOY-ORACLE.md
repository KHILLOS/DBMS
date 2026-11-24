# 🚀 Oracle Cloud Free VM par MED Health Locker deploy karna

**Time: ~15 minute.** Bundle mein `dist/` prebuilt hai — VM par build nahi karna padega.

> VM specs fine hain: 1GB RAM / 1 OCPU. Production server sirf ~150MB RAM leta hai.

---

## Step 0 — VM ki basic info

SSH se VM mein jao. Phir ye chalao:
```bash
uname -m
```
- `x86_64` → neeche wale Node commands use karo
- `aarch64` (ARM) → wahi commands, ARM version khud mil jayega

---

## Step 1 — Node.js install (2 min)

> **Node 24 LTS ya Node 26 — dono tested hain.** Node 26 use kar sakte ho (Oct 2026 mein LTS ban jayega);
> Node 24 sabse conservative choice hai (LTS till April 2028).

**Ubuntu:**
```bash
curl -fsSL https://deb.nodesource.com/setup_26.x | sudo -E bash -   # ya setup_24.x for LTS
sudo apt-get install -y nodejs
node -v   # v26.x ya v24.x
```

**Oracle Linux / CentOS:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_26.x | sudo bash -   # ya setup_24.x for LTS
sudo yum install -y nodejs
node -v
```

## Step 2 — Ports kholo (sabse common gotcha!)

Oracle Cloud mein firewall **2 jagah** hota hai — dono kholne padenge:

**A) Oracle Console (browser):**
1. https://cloud.oracle.com → Compute → Instances → apni VM
2. Primary VNIC → Sub-SECURITY-LIST par jao
3. **Add Ingress Rules:**
   - Source: `0.0.0.0/0`, Protocol: TCP, Port: **80**
   - Source: `0.0.0.0/0`, Protocol: TCP, Port: **443** (HTTPS ke liye, optional abhi)

**B) VM ke andar (SSH):**

Ubuntu:
```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT
sudo netfilter-persistent save   # ya: sudo apt install iptables-persistent
```
> Oracle ka Ubuntu image default mein restrictive iptables rakhta hai — isliye ye step zaroori hai!

Oracle Linux:
```bash
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

## Step 3 — Website download + setup (5 min)

```bash
sudo mkdir -p /opt/med-website
sudo chown $USER /opt/med-website
cd /opt/med-website

# Google Drive se bundle download (link DEPLOY ke message mein milega):
wget -O med-deploy.tar.gz '<DOWNLOAD_LINK>'

tar xzf med-deploy.tar.gz --strip-components=1

# Sirf production dependencies (better-sqlite3 ki binary package ke andar
# included hai — koi compile nahi, koi build tools nahi chahiye):
npm ci --omit=dev

# Secret env file banao:
cat > .env << 'EOF'
JWT_SECRET=CHANGE-ME-koi-lamba-random-string-likho-yahan
PORT=3001
EOF
```

## Step 4 — Test run (30 sec)

```bash
NODE_ENV=production node server/index.js
```
```
[api] serving built frontend from dist/
[api] MED Health Locker ready → http://localhost:3001
```
Dikha? Ctrl+C kar do. Ab permanent service banayenge.

## Step 5 — systemd service (auto-start + crash-restart)

```bash
sudo cp deploy/med-locker.service /etc/systemd/system/
# agar path /opt/med-website nahi hai to file mein WorkingDirectory edit karo
sudo systemctl daemon-reload
sudo systemctl enable --now med-locker
sudo systemctl status med-locker   # active (running) dikhna chahiye
```

Ab site live hai: **http://<VM-KA-PUBLIC-IP>:3001**

> Port 80 direct chahiye? Ye ek baar chala do:
> ```bash
> sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3001
> ```

## Step 6 — HTTPS (optional, 5 min)

Free subdomain + auto-certificate — `deploy/Caddyfile-HTTPS.md` mein steps hain.

---

## Verification checklist

| Check | Kaise |
|---|---|
| Site khulti hai | Browser mein `http://IP:3001` |
| Theme toggle | Top bar — light/dark switch + background video change |
| Register/Login | Pehla account admin banta hai |
| Upload | PDF/JPG/PNG — file VM par `server/uploads/` mein jayegi |
| Data persistent | VM restart ke baad bhi data rahega (SQLite disk par) |
| Reboot-safe | `sudo reboot` → site khud wapas aayegi (systemd) |

## Rozana ka kaam

- Logs: `journalctl -u med-locker -f`
- Restart: `sudo systemctl restart med-locker`
- Update (naya version): bundle dobara download + extract + `npm ci --omit=dev` + restart

## RAM note (1GB VM)

- Node server: ~150MB
- 450MB tak theek hai; `MemoryMax=450M` service mein set hai
- Agar kabhi OOM dikhe (VM swap use kare): `sudo dmesg | grep -i oom` — free tier A1 (ARM 4GB) par upgrade bhi free hai hamesha ke liye
