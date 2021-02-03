#!/usr/bin/env bash

set +v

tag=`date +%Y%m%d-%H%M%S`

git tag $tag
if [[ $? -gt 0 ]]; then
	exit 1;
fi

git push --no-verify origin $tag
if [[ $? -gt 0 ]]; then
	exit 1;
fi

git push --no-verify
if [[ $? -gt 0 ]]; then
	exit 1;
fi

ssh nuc "bash -c 'cd container/domiqtt/app; git pull'"
if [[ $? -gt 0 ]]; then
	exit 1;
fi

scp ./config.json nuc:/mnt/ssd/container/domiqtt/config/
if [[ $? -gt 0 ]]; then
	exit 1;
fi

ssh nuc "bash -c 'cd container/; docker-compose restart domiqtt'"
if [[ $? -gt 0 ]]; then
	exit 1;
fi
