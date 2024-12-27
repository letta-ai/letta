#!/bin/bash

 if [ -z "$1" ];
   then echo "Please provide a branch name to push to. Example: ./scripts/oss-sync-scripts/push.sh my-branch-name";
    exit 1;
 fi

 git subtree push --prefix apps/core git@github.com:letta-ai/letta.git $1
