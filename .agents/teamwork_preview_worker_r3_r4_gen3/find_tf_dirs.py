import os

search_roots = [
    r"C:\Users\benny\AppData\Local",
    r"C:\Users\benny\AppData\Roaming",
    r"C:\Users\benny",
    r"d:\New folder (6)\kaluna\kaluna"
]

for sroot in search_roots:
    if not os.path.exists(sroot):
        continue
    for root, dirs, files in os.walk(sroot):
        for d in dirs:
            if "terraform" in d.lower():
                print("DIR:", os.path.join(root, d))
        for f in files:
            if f.startswith("terraform-provider") or f.endswith(".hcl") or f.endswith(".exe"):
                if "terraform" in f.lower():
                    print("FILE:", os.path.join(root, f))
