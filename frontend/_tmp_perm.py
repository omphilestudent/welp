import os, stat
path = r"node_modules/.bin/vite"
print(oct(os.stat(path).st_mode))
