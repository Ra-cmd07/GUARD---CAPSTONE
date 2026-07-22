# AttendBox Mobile App 📱

A React Native mobile application for the AttendBox school attendance system, built with Expo.

## 🎯 Features

### For Parents:
- ✅ View children's information
- ✅ Real-time attendance notifications
- ✅ Attendance history with photos
- ✅ Multiple children support

### For Students:
- ✅ Display personal QR code for scanning
- ✅ View attendance history
- ✅ Check Time-In/Time-Out records
- ✅ Session tracking (AM/PM)

## 📋 Prerequisites

- Node.js 16+ installed
- npm or yarn package manager
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for testing)
- Backend server running

## 🚀 Installation

### 1. Install Dependencies

```bash
cd Attendbox-Mobile
npm install --legacy-peer-deps
```

### 2. Configure Backend URL

Edit `src/config/api.ts` and update the backend URL:

```typescript
export const API_BASE_URL = 'http://YOUR_BACKEND_IP:5000/api';
// Example: 'http://10.194.43.63:5000/api'
```

**Important:** Use your computer's local IP address, NOT `localhost`!

To find your IP:
- Windows: `ipconfig` (look for IPv4 Address)
- Mac/Linux: `ifconfig` or `ip addr`

### 3. Start the App

```bash
npm start
```

This will open Expo DevTools in your browser.

## 📱 Running on Device

### Option 1: Expo Go (Easiest - For Testing)

1. Install **Expo Go** app from:
   - [App Store (iOS)](https://apps.apple.com/app/expo-go/id982107779)
   - [Play Store (Android)](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Scan the QR code from your terminal with:
   - **iOS**: Camera app
   - **Android**: Expo Go app

3. Make sure your phone and computer are on the **same WiFi network**

### Option 2: Android Build

```bash
npm run android
```

Requirements:
- Android Studio installed
- Android device connected via USB or emulator running

### Option 3: iOS Build (Mac only)

```bash
npm run ios
```

Requirements:
- Xcode installed
- iOS Simulator or device connected

## 🔧 Configuration

### Backend Connection

The app expects your backend to be running with these endpoints:

```
POST /api/auth/login          - User authentication
GET  /api/students            - Fetch children (for parents)
GET  /api/students/:id        - Fetch student profile
GET  /api/attendance          - Fetch attendance records
```

### Testing Credentials

Use the same credentials from your web frontend:

**Parent:**
```
Username: parent1 (or any parent account)
Password: 12345678
```

**Student:**
```
Username: student1 (or any student account)
Password: 12345678
```

## 📂 Project Structure

```
Attendbox-Mobile/
├── App.tsx                          # Main app entry
├── app.json                         # Expo configuration
├── src/
│   ├── config/
│   │   └── api.ts                  # API client setup
│   ├── context/
│   │   └── AuthContext.tsx         # Authentication state
│   ├── navigation/
│   │   └── AppNavigator.tsx        # Navigation setup
│   ├── screens/
│   │   ├── LoginScreen.tsx         # Login page
│   │   ├── ParentDashboardScreen.tsx  # Parent dashboard
│   │   └── StudentPortalScreen.tsx    # Student QR code
│   └── types/
│       └── index.ts                # TypeScript types
```

## 🎨 Screens Overview

### 1. Login Screen
- Username/password authentication
- JWT token management
- Redirects based on user role

### 2. Parent Dashboard
- View all children
- See recent attendance
- Pull to refresh
- Attendance photos
- Status badges (Time-In, Time-Out, Late)

### 3. Student Portal
- Display QR code for scanning
- Personal information
- Attendance history
- Session tracking

## 🔐 Security

- JWT token stored securely in AsyncStorage
- Automatic token attachment to API requests
- 401 handling with auto-logout
- Secure password input

## 🐛 Troubleshooting

### Common Issues:

**1. Cannot connect to backend**
```
Error: Network request failed
```
**Solution:**
- Make sure backend is running
- Use local IP address, not `localhost`
- Ensure phone and computer on same WiFi
- Check firewall settings

**2. QR Code not displaying**
```
QR Code shows blank
```
**Solution:**
- Check if student profile has all required fields
- Verify API response in console
- Restart the app

**3. Login fails**
```
Invalid credentials
```
**Solution:**
- Check username/password
- Verify backend is accessible
- Check API URL in config

**4. App won't start**
```
Module not found
```
**Solution:**
```bash
rm -rf node_modules
npm install --legacy-peer-deps
```

## 📊 API Integration

The app integrates with your existing backend:

### Authentication Flow:
```
1. User enters credentials
2. POST /api/auth/login
3. Receive JWT token + user profile
4. Store in AsyncStorage
5. Include token in all subsequent requests
```

### Data Fetching:
```
- Pull to refresh triggers API calls
- Automatic refresh on screen focus
- Loading states during API calls
- Error handling with user feedback
```

## 🎯 Next Steps

### Planned Features:
- [ ] Teacher dashboard
- [ ] Admin dashboard
- [ ] Push notifications
- [ ] Offline mode
- [ ] Photo capture integration
- [ ] Attendance marking (for teachers)
- [ ] Reports and analytics

## 📱 Building for Production

### Android APK:
```bash
expo build:android
```

### iOS IPA:
```bash
expo build:ios
```

### App Store/Play Store:
Follow Expo's [deployment guide](https://docs.expo.dev/distribution/introduction/)

## 🤝 Contributing

This app is part of the AttendBox Capstone project.

## 📄 License

Educational project for school use.

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section
2. Review backend logs
3. Check Expo DevTools console
4. Verify network connectivity

---

**Built with ❤️ using React Native + Expo**

**Version:** 1.0.0
**Last Updated:** July 2, 2026
