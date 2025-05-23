#!/bin/bash
# Install Docker containers used in testing

sudo -u ci-runner docker pull redis
sudo -u ci-runner docker pull postgres
sudo -u ci-runner docker pull pgvector/pgvector:pg17
# TODO: Deal with arm architecture or wtv
# sudo -u ci-runner docker pull e2bdev/code-interpreter:latest
