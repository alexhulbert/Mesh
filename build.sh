if [ "$NO_CORDOVA" = "true"]; then
  alias cordova=phonegap
fi
echo "Copying over assets..."
source buildoptions.env
rm -R build 2> /dev/null
mkdir build
cp -R buildfiles build/workspace
mkdir build/workspace/www/css
cp -R public/img build/workspace/www
rm build/workspace/www/img/bkg.png 2> /dev/null
cp -R public/font build/workspace/www
cp -R public/js/lib build/workspace/www/js
cp -R public/js/themes build/workspace/www/js
echo "Compiling HTML for mobile devices..."
if [ "$MODE" = "debug" ]; then
  (cd views && jade -P -p . -O "{ mobile: true, url: \"$URL\" }" < main.jade > ../build/workspace/www/index.html)
else
  (cd views && jade -p . -O "{ mobile: true, q34url: \"$URL\" }" < main.jade > ../build/workspace/www/index.html)
fi
echo "Compiling stylesheets to CSS..."
stylus public/css -o build/workspace/www/css
(cd build/workspace && cordova plugin add org.apache.cordova.media)
if ["$USE_CROSSWALK" = "true"]; then
  echo "Building for Android..."
  cordova build android
  echo "Downloading Crosswalk..."
  curl -so build/crosswalk.zip "https://download.01.org/crosswalk/releases/crosswalk/android/stable/$CROSSWALK/arm/crosswalk-cordova-$CROSSWALK-arm.zip"
  unzip -qd build build/crosswalk.zip
  mv build/crosswalk-* build/crosswalk
  (cd build/workspace && zip -qr ../Workspace.zip .)
  cp -a build/crosswalk/framework/* build/workspace/platforms/android/CordovaLib/
  cp -a build/crosswalk/VERSION build/workspace/platforms/android/
  echo "Building Crosswalk..."
  (cd build/workspace/platforms/android/CordovaLib/ && android update project --subprojects --path . --target "$ANDROID_TARGET" && ant debug)
  echo "Rebuilding with Crosswalk..."
  if ["$MODE" = "debug"]; then
    cordova build android
  else
    cordova build --release android
  fi
  echo "Archiving Application"
  rm -R build/crosswalk
  (cd build/workspace && zip -qr ../Workspace.zip .)
  echo "Done! You Can Find Your APK in /platforms/android/bin"
else
  (cd build/workspace && zip -qr ../Workspace.zip .)
  echo "Built Successfully! Compile using \`cordova build <PLATFORM>\`."
fi

#TODO: REMOVE FOLLOWING LINES
mv build/Workspace.zip public/mesh.source.latest.zip
echo "Open it at: https://mesh-triforce1.c9.io/mesh.source.latest.zip"