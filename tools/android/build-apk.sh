#!/usr/bin/env bash
# Construit dist/BoxingLegend.apk sans SDK Android (outils récupérés sur Maven Central).
# Prérequis : JDK 11+, Node, Python 3. Usage : npm run apk
set -euo pipefail
unset JAVA_TOOL_OPTIONS_DUMMY
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
A="$ROOT/tools/android"; C="$A/.cache"; W="$C/work"
M=https://repo1.maven.org/maven2
mkdir -p "$C" "$W"
get() { [ -f "$C/$2" ] || { for i in 1 2 3 4 5; do curl -sSfL -o "$C/$2" "$M/$1" && break; sleep $((i*3)); done; }; }
get com/google/android/android/4.1.1.4/android-4.1.1.4.jar android.jar
get com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar dx.jar
get com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar apksig.jar
VERSION_CODE="${VERSION_CODE:-$(git -C "$ROOT" rev-list --count HEAD 2>/dev/null || echo 1)}"
VERSION_NAME="${VERSION_NAME:-1.0.$VERSION_CODE}"
echo "▶ Build web (fichier unique)"; (cd "$ROOT" && node tools/build.js)
echo "▶ Compilation Java"; rm -rf "$W/classes" && mkdir -p "$W/classes"
javac --release 8 -nowarn -classpath "$C/android.jar" -d "$W/classes" "$A/src/com/boxinglegend/game/MainActivity.java" 2>&1 | grep -v "JAVA_TOOL_OPTIONS" || true
echo "▶ Dex"; java -cp "$C/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=24 --output="$W/classes.dex" "$W/classes"
echo "▶ Assemblage"; python3 "$A/pack.py" "$W/classes.dex" "$ROOT/dist/index.html" "$A/icon.png" "$W/unsigned.apk" "$VERSION_CODE" "$VERSION_NAME"
KS="${KEYSTORE:-$A/boxinglegend-dev.p12}"; PW="${KEYSTORE_PASS:-boxinglegend}"
if [ ! -f "$KS" ]; then keytool -genkeypair -keystore "$KS" -storetype PKCS12 -storepass "$PW" -keypass "$PW" -alias boxinglegend -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Boxing Legend, O=Boxing Legend, C=FR" >/dev/null; fi
echo "▶ Signature"; rm -rf "$W/signer" && mkdir -p "$W/signer"
javac -nowarn -cp "$C/apksig.jar" -d "$W/signer" "$A/signer/Sign.java"
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED -cp "$C/apksig.jar:$W/signer" Sign "$W/unsigned.apk" "$ROOT/dist/BoxingLegend.apk" "$KS" "$PW"
echo "✔ $ROOT/dist/BoxingLegend.apk ($(du -h "$ROOT/dist/BoxingLegend.apk" | cut -f1)) — version $VERSION_NAME"
