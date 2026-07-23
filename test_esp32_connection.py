#!/usr/bin/env python3
"""
ESP32 Connection Tester
Tests if ESP32 can reach the server and diagnoses issues
"""

import socket
import subprocess
import sys

def test_port_open(host, port):
    """Test if a port is open and accepting connections"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(3)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception as e:
        print(f"  ✗ Error testing port: {e}")
        return False

def get_local_ip():
    """Get the local IP address"""
    try:
        # Create a socket to get the local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "192.168.1.29"  # Fallback

def check_firewall_rules():
    """Check if firewall rules exist"""
    try:
        result = subprocess.run(
            ['netsh', 'advfirewall', 'firewall', 'show', 'rule', 'name=all', 'protocol=tcp', 'localport=8080'],
            capture_output=True,
            text=True,
            timeout=5
        )
        return 'Rule Name' in result.stdout
    except Exception:
        return False

def main():
    print("=" * 50)
    print("  ESP32 Connection Diagnostic")
    print("=" * 50)
    print()
    
    # Get local IP
    local_ip = get_local_ip()
    print(f"[1] Your computer IP: {local_ip}")
    print()
    
    # Test localhost
    print("[2] Testing localhost (127.0.0.1:8080)...")
    if test_port_open('127.0.0.1', 8080):
        print("  ✓ Localhost works - Server is running")
    else:
        print("  ✗ Localhost FAILED - Server is NOT running!")
        print("  → Start server: python trilateration_server_MULTI.py")
        sys.exit(1)
    print()
    
    # Test local IP
    print(f"[3] Testing LAN IP ({local_ip}:8080)...")
    if test_port_open(local_ip, 8080):
        print("  ✓ LAN IP works - Server accessible on network")
    else:
        print("  ✗ LAN IP FAILED - Firewall is blocking!")
        print("  → This is the problem ESP32 is facing")
    print()
    
    # Test from 0.0.0.0
    print("[4] Testing 0.0.0.0:8080...")
    if test_port_open('0.0.0.0', 8080):
        print("  ✓ Server bound to 0.0.0.0 correctly")
    else:
        print("  ⚠ May not be bound to all interfaces")
    print()
    
    # Check firewall
    print("[5] Checking firewall rules...")
    if check_firewall_rules():
        print("  ✓ Firewall rules exist for port 8080")
        print("  ⚠ But they might not be working correctly")
    else:
        print("  ✗ NO firewall rules for port 8080")
        print("  → Run FIX_FIREWALL_NUCLEAR.bat as Administrator")
    print()
    
    print("=" * 50)
    print("  RECOMMENDATION:")
    print("=" * 50)
    print()
    
    # Determine the issue
    localhost_works = test_port_open('127.0.0.1', 8080)
    lan_works = test_port_open(local_ip, 8080)
    
    if localhost_works and not lan_works:
        print("PROBLEM CONFIRMED: Firewall is blocking external access")
        print()
        print("SOLUTION:")
        print("  1. Run: DISABLE_FIREWALL_TEMP.bat (as Administrator)")
        print("  2. Test ESP32 (press RESET button)")
        print("  3. If it works, firewall WAS the blocker")
        print("  4. Re-enable firewall: ENABLE_FIREWALL.bat")
        print("  5. Then add proper firewall exception")
        print()
        print("OR check for antivirus firewall:")
        print("  - Run: CHECK_ANTIVIRUS.bat")
        print("  - Add exception in your antivirus for port 8080")
    elif not localhost_works:
        print("PROBLEM: Server is not running")
        print()
        print("SOLUTION:")
        print("  cd trilateration_server")
        print("  python trilateration_server_MULTI.py")
    else:
        print("Server seems accessible, check:")
        print("  - ESP32 WiFi network (should be same as computer)")
        print("  - ESP32 SERVER_URL (should be http://%s:8080/update)" % local_ip)
        print("  - Router AP Isolation (disable if enabled)")
    
    print()
    print("=" * 50)

if __name__ == '__main__':
    main()
