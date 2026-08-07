import os

search_paths = [
    os.path.expanduser("~"),
    "C:\\AppData",
    "C:\\Users\\benny\\AppData",
    "C:\\terraform",
    "C:\\Program Files",
]

found = []
for base in search_paths:
    if not os.path.exists(base):
        continue
    for root, dirs, files in os.walk(base):
        for f in files:
            if "terraform-provider" in f or f.endswith(".lock.hcl"):
                found.append(os.path.join(root, f))
        if len(found) > 20:
            break

print("Found terraform files:")
for p in found:
    print(p)
