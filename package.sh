#!/bin/bash

# bash script that creates zip file
# used to register this extension to chrome web store

zip -r org-protocol-client.zip * -x .git .gitignore package.sh
