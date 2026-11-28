# Sistema il progetto Android generato da Capacitor (eseguito dal workflow)
import re, sys, json
ver = json.load(open('package.json'))['version']
run = sys.argv[1]

m = 'android/app/src/main/AndroidManifest.xml'
s = open(m).read()
perm = ('<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n'
        '    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />\n'
        '    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />\n'
        '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n'
        '    <uses-permission android:name="android.permission.USE_BIOMETRIC" />\n    ')
s = s.replace('<application', perm + '<application', 1)
meta = ('    <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_rigordati" />\n'
        '        <meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/rigordati_corallo" />\n'
        '        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="domande" />\n    ')
s = s.replace('</application>', meta + '</application>', 1)
open(m, 'w').write(s)

open('android/app/src/main/res/values/rigordati_colori.xml', 'w').write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="rigordati_corallo">#FF6B5B</color>\n</resources>\n')

g = 'android/app/build.gradle'
s = open(g).read()
s = re.sub(r'versionCode \d+', f'versionCode {run}', s)
s = re.sub(r'versionName "[^"]*"', f'versionName "{ver}"', s)
open(g, 'w').write(s)

with open('android/variables.gradle', 'a') as f:
    f.write('\next {\n    rgcfaIncludeGoogle = true\n}\n')
print('Android sistemato, versione', ver, 'build', run)
