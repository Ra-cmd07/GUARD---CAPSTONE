# AttendBox Mobile - Quick Start ⚡

## 🚀 Get Started in 3 Steps

### **Step 1: Configure Backend URL**

Edit `src/config/api.ts` line 5:

```typescript
export const API_BASE_URL = 'http://YOUR_IP_HERE:5000/api';
```

**Find your IP:**
```cmd
ipconfig
```
Example: `http://10.194.43.63:5000/api`

---

### **Step 2: Start the App**

```cmd
cd Attendbox-Mobile
npm start
```

---

### **Step 3: Open on Your Phone**

1. Install **Expo Go** app on your phone
2. Scan the QR code from your terminal
3. Make sure phone & computer on same WiFi

---

## 📱 Test Credentials

**Parent:**
- Username: `parent1`
- Password: `12345678`

**Student:**
- Username: `student1`
- Password: `12345678`

---

## ✅ That's It!

You should now see:
- **Parents**: Dashboard with children and attendance
- **Students**: QR code ready to scan at kiosk

---

## 🐛 Issues?

**Cannot connect to backend:**
1. Check backend is running
2. Use IP address, not `localhost`
3. Same WiFi network

**QR code not showing:**
- Check student profile has all fields
- Restart app

---

**Need more help?** Check `README.md` or `ATTENDBOX_MOBILE_SETUP.md`
