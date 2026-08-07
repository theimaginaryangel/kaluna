import os

aws_vars = {k: v for k, v in os.environ.items() if 'AWS' in k or 'LOCALSTACK' in k or 'TF' in k}
print("AWS and TF Environment variables:")
for k, v in aws_vars.items():
    if 'SECRET' in k or 'TOKEN' in k or 'KEY' in k:
        print(f"  {k} = {v[:4]}...{v[-4:] if len(v)>8 else ''}")
    else:
        print(f"  {k} = {v}")
