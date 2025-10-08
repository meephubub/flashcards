import VerifyClient from "./VerifyClient";

export default function VerifyPage() {
  const defaultEvmAddress = process.env.EVM_ADDRESS || process.env.NEXT_PUBLIC_EVM_ADDRESS || "";
  return <VerifyClient defaultEvmAddress="Please Sign In" />;
}
