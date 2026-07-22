# 🔧 Troubleshooting Guide - AttendBox Mobile

## Common Issues & Solutions

---

## 🌐 Connection Issues

### **Problem: "Network Error" or "Cannot connect to backend"**

**Symptoms:**
- Login button loads forever
- "Network request failed" error
- Data doesn't load

**Solutions:**

✅ **1. Check Backend is Running**
```cmd
# In guard-backend folder
npm start
```
Should show: `Server listening on port 5000`

✅ **2. Verify Backend URL**
Edit `src/config/api.ts`:
```typescript
export const API_BASE_URL = 'http://YOUR_IP:5000/api';
// NOT: 'http://localhost:5000/api'
```

✅ **3. Find Your IP Address**
```cmd
ipconfig
```
Look for **IPv4 Address** under WiFi adapter
Example: `192.168.1.100` or `10.194.43.63`

✅ **4. Same WiFi Network**
- Phone and computer MUST be on same WiFi
- Check both devices are connected to same network

✅ **5. Test Backend in Browser**
On your phone's browser, visit:
```
http://YOUR_IP:5000/api
```
Should see API response, not error

✅ **6. Check Windows Firewall**
```cmd
# Allow Node.js through firewall
Windows Defender Firewall → Allow an app → Node.js → Allow
```

✅ **7. Restart Everything**
```cmd
# Stop backend
Ctrl + C

# Stop mobile app  
Ctrl + C

# Restart backend
npm start (in guard-backend)

# Restart mobile
npm start (in Attendbox-Mobile)
```

---

## 🔐 Login Issues

### **Problem: "Invalid credentials" or Login fails**

**Solutions:**

✅ **1. Verify Credentials**
Test credentials:
```
Parent: parent1 / 12345678
Student: student1 / 12345678
```

✅ **2. Check User Exists**
In backend, run:
```cmd
node check-users.js
```

✅ **3. Try Web Login First**
Login to web frontend with same credentials
If web works, mobile should too

✅ **4. Clear App Storage**
- Close Expo app completely
- Reopen and try again
- AsyncStorage will clear on fresh start

---

## 📱 QR Code Issues

### **Problem: QR code not displaying / shows blank**

**Solutions:**

✅ **1. Check Student Profile**
Student MUST have:
- LRN
- Name
- Grade
- Section

✅ **2. Verify API Response**
Check Expo DevTools console for API response

✅ **3. Restart App**
- Close completely
- Reopen
- Login again

✅ **4. Test Different Student**
Try logging in as different student account

---

## 🖼️ Photo Issues

### **Problem: Photos not loading**

**Solutions:**

✅ **1. Check Internet Connection**
Photos hosted on Cloudinary (requires internet)

✅ **2. Verify Photo URL**
Check if `photo_path` in API response is valid URL

✅ **3. Test URL in Browser**
Copy photo URL and open in browser

---

## 📱 Expo Go Issues

### **Problem: "Something went wrong" in Expo Go**

**Solutions:**

✅ **1. Update Expo Go**
- Update to latest version from App Store/Play Store

✅ **2. Clear Expo Cache**
```cmd
expo start -c
```

✅ **3. Reinstall Dependencies**
```cmd
del /s /q node_modules
del package-lock.json
npm install --legacy-peer-deps
```

✅ **4. Check Expo SDK Version**
Ensure using Expo SDK 54 (check `app.json`)

---

## 🔄 Refresh Issues

### **Problem: Pull-to-refresh not working**

**Solutions:**

✅ **1. Pull Harder**
- Swipe down more forcefully
- Pull from top of list

✅ **2. Check Loading State**
- Should see spinner while refreshing
- Wait for completion

✅ **3. Restart App**
- Close and reopen

---

## 📊 Data Not Updating

### **Problem: Old data showing / not refreshing**

**Solutions:**

✅ **1. Manual Refresh**
- Pull down on screen to refresh

✅ **2. Check Backend Data**
- Verify data exists in database
- Check API endpoints return data

✅ **3. Logout and Login**
- Clears all cached data
- Forces fresh fetch

---

## 🚫 Installation Issues

### **Problem: "npm install" fails**

**Solutions:**

✅ **1. Use Legacy Peer Deps**
```cmd
npm install --legacy-peer-deps
```

✅ **2. Clear Cache**
```cmd
npm cache clean --force
npm install --legacy-peer-deps
```

✅ **3. Delete node_modules**
```cmd
del /s /q node_modules
del package-lock.json
npm install --legacy-peer-deps
```

✅ **4. Check Node Version**
```cmd
node -v
# Should be 16.x or higher
```

---

## ⚡ Performance Issues

### **Problem: App slow or laggy**

**Solutions:**

✅ **1. Close Other Apps**
- Free up phone memory
- Close background apps

✅ **2. Restart Phone**
- Fresh start often helps

✅ **3. Check WiFi Speed**
- Slow WiFi = slow data loading
- Try different network

✅ **4. Use Production Build**
- Development mode is slower
- Build APK for better performance

---

## 🎨 UI Issues

### **Problem: Layout looks broken / text cut off**

**Solutions:**

✅ **1. Check Phone Size**
- App optimized for standard sizes
- Very small/large screens may vary

✅ **2. Restart App**
- Sometimes layout recalculates

✅ **3. Rotate Screen**
- Try landscape mode
- Rotate back to portrait

---

## 📱 Platform-Specific Issues

### **Android:**

**Problem: White screen on start**
- Wait 10-15 seconds
- First load takes time

**Problem: Back button crashes**
- Fixed in navigation
- Update app if issue persists

### **iOS:**

**Problem: Keyboard covers input**
- KeyboardAvoidingView should handle this
- Try scrolling up while keyboard open

---

## 🆘 Emergency Fixes

### **Problem: App completely broken**

**Nuclear Option - Full Reset:**

```cmd
# 1. Delete everything
cd Attendbox-Mobile
del /s /q node_modules
del package-lock.json

# 2. Reinstall
npm install --legacy-peer-deps

# 3. Clear Expo cache
expo start -c

# 4. Restart phone
# 5. Try again
```

---

## 📝 Debug Checklist

Before asking for help, check:

- [ ] Backend running? (`npm start` in guard-backend)
- [ ] Correct IP in `src/config/api.ts`?
- [ ] Same WiFi network?
- [ ] Valid credentials?
- [ ] Expo Go updated?
- [ ] Node.js 16+?
- [ ] Tried restarting everything?
- [ ] Firewall allowing Node.js?
- [ ] Can access backend in browser?
- [ ] Tried different user account?

---

## 🔍 Getting More Info

### **View Logs:**

**Expo DevTools:**
- Shows API calls
- Shows errors
- Shows console.log

**Backend Logs:**
- Check terminal running backend
- Look for API errors

**Network Tab:**
- Open browser DevTools
- See API requests/responses

---

## 📞 Still Having Issues?

### **Check Documentation:**
1. `README.md` - Full documentation
2. `QUICKSTART.md` - Quick start
3. `ATTENDBOX_MOBILE_SETUP.md` - Setup guide

### **Common Causes:**
- 90% of issues = wrong IP or WiFi network
- 5% = backend not running
- 5% = other issues

### **Best Practice:**
1. Start with clean state
2. Follow QUICKSTART.md exactly
3. Test on web first
4. Then try mobile

---

## ✅ Success Indicators

**App is working when you see:**
- ✅ Login screen loads
- ✅ Can login successfully
- ✅ Dashboard shows data
- ✅ Photos load
- ✅ Pull-to-refresh works
- ✅ QR code displays (students)
- ✅ Logout works

---

## 💡 Prevention Tips

**Avoid issues by:**
1. Keep backend running
2. Stay on same WiFi
3. Use correct IP address
4. Update Expo Go regularly
5. Clear cache when updating
6. Test on web first
7. Keep dependencies updated

---

**Most problems are solved by:**
1. Correct IP address
2. Same WiFi network
3. Backend running

**Check these three things first! 🎯**
