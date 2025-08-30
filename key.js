import { randomBytes } from "crypto";

// Generate 32 random bytes and encode as base64
const key = randomBytes(32).toString("base64");

console.log(key); // e.g. "r7uEqp2RW7q5sSe2jb2NCKyP5uVYVtDloXhZopjylH8="
