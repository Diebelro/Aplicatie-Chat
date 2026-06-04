#!/usr/bin/env bash
curl -s -X POST http://127.0.0.1:3002/api/auth/login \
  -H 'Content-Type: application/json' \
  --data '{"email":"floroiuelvisalin@gmail.com","password":"DiebelTemp2026!"}'
echo
