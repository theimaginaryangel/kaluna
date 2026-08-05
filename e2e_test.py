#!/usr/bin/env python3
"""
Kaluna Root E2E Test Wrapper
Invokes services/e2e/e2e_test.py
"""

import sys
import os

services_e2e_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "services", "e2e")
sys.path.insert(0, services_e2e_path)

import e2e_test

if __name__ == "__main__":
    e2e_test.main()
