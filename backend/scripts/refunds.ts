import { ethers } from 'ethers';

// 1. Cấu hình
const RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// 2. Điền Private Key của CÁI VÍ ĐANG GIỮ TIỀN (lấy từ backend hoặc MetaMask)
const senderPrivateKey = "0x78ed24fe2334fd9be2b4aba1d4e2f7d52107a40d16bcd840db06cee7136d88d5";

// 3. Điền địa chỉ Public Address của ví Master (Ví mà bạn muốn trả lại tiền)
const masterAddress = "0x3EeAc1b2b9557b8C8abc7280D7691f023983B451";

async function returnFunds() {
  const wallet = new ethers.Wallet(senderPrivateKey, provider);
  const balance = await provider.getBalance(wallet.address);
  
  console.log(`Số dư hiện tại: ${ethers.formatEther(balance)} BNB`);

  // Tính toán số tiền gửi lại (Giữ lại báo phí gas 0.0003 BNB)
  const gasReserve = ethers.parseEther("0.0003");
  const amountToSend = balance - gasReserve;

  if (amountToSend <= 0n) {
    console.log("Ví đã cạn sạch, không đủ tiền trả + phí Gas!");
    return;
  }

  console.log(`Đang gửi lại ${ethers.formatEther(amountToSend)} BNB cho Master...`);

  // Bắn giao dịch đi (Không cần MetaMask)
  const tx = await wallet.sendTransaction({
    to: masterAddress,
    value: amountToSend
  });

  console.log("Đã gửi! Mã giao dịch (Tx Hash):", tx.hash);
  await tx.wait();
  console.log("Giao dịch đã xác nhận thành công trên mạng!");
}

returnFunds().catch(console.error);
