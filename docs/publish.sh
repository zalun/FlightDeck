#!/bin/zsh

set -e
cd `dirname $0`

REPO=$(dirname $PWD)
GH=_gh-pages

echo "Updating gh-pages branch."
git fetch origin
git co origin/gh-pages -b gh-pages || git co gh-pages && git pull
git co -

if [[ ! -d $GH ]]; then
  print "cloning self into $GH"
  git clone $REPO $GH
  pushd $GH
  git checkout -b gh-pages origin/gh-pages
  popd
fi

pushd $GH && git pull && set +e && rm -rf *
set -e
popd

make clean dirhtml
cp -r build/dirhtml/* $GH
pushd $GH
touch .nojekyll
git add .
git commit -am "gh-pages build on $(date)"
git push origin gh-pages
popd
