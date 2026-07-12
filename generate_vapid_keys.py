import base64
from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid

v = Vapid()
v.generate_keys()

pub_raw = v.public_key.public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint
)
pub_b64 = base64.urlsafe_b64encode(pub_raw).rstrip(b'=').decode()

priv_value = v.private_key.private_numbers().private_value
key_size = (v.private_key.curve.key_size + 7) // 8
priv_bytes = priv_value.to_bytes(key_size, byteorder='big')
priv_b64 = base64.urlsafe_b64encode(priv_bytes).rstrip(b'=').decode()

print("Add these to Vercel environment variables:\n")
print(f"VAPID_PUBLIC_KEY={pub_b64}")
print(f"VAPID_PRIVATE_KEY={priv_b64}")
