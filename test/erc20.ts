import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { ERC20 } from "../typechain/ERC20";
import { ERC20__factory } from "../typechain/factories/ERC20__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

const { provider } = waffle;

describe("erc20", function () {
  let token: ERC20;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];

  before(async function () {
    signers = await ethers.getSigners();
    const deployer = new ERC20__factory(signers[0]);
    token = await deployer.deploy("token", "TKN");
    await token.mint(signers[0].address, ethers.utils.parseEther("100"));
  });


  describe("transfer functionality", async () => {

    it("transfers successfully", async () => {
      await token.transfer(signers[1].address, ethers.utils.parseEther("5"));
      expect(await token.balanceOf(signers[0].address)).to.be.eq(
        ethers.utils.parseEther("95")
      );
      expect(await token.balanceOf(signers[1].address)).to.be.eq(
        ethers.utils.parseEther("5")
      );
    });

    it("transfer returns true", async () => {
      expect(await token.callStatic.transfer(signers[1].address, ethers.utils.parseEther("0"))).to.equal(true);
    });

    it("does not transfer more than balance", async () => {
      const tx = token.transfer(
        signers[1].address,
        ethers.utils.parseEther("500")
      );
      await expect(tx).to.be.revertedWith("ERC20: insufficient-balance");
    });

    it("can't transfer to zero address", async () => {
      const tx = token.transfer(
        "0x0000000000000000000000000000000000000000",
        ethers.utils.parseEther("5")
      );
      await expect(tx).to.be.reverted;
    });

    it("can't transfer to token address", async () => {
      const tx = token.transfer(
        token.address,
        ethers.utils.parseEther("5")
      );
      await expect(tx).to.be.reverted;
    });

    it("supply didn't change", async () => {
      expect(await token.callStatic.totalSupply()).to.equal(ethers.utils.parseEther("100"));
    });

  });

  describe("transferFrom functionality", async () => {

    it("transfers successfully", async () => {
      await token.transferFrom(signers[0].address, signers[1].address, ethers.utils.parseEther("5"));
      expect(await token.balanceOf(signers[0].address)).to.be.eq(
        ethers.utils.parseEther("90")
      );
      expect(await token.balanceOf(signers[1].address)).to.be.eq(
        ethers.utils.parseEther("10")
      );
    });

    it("transferFrom returns true", async () => {
      expect(await token.callStatic.transferFrom(signers[0].address, signers[1].address, ethers.utils.parseEther("0"))).to.equal(true);
    });

    it("does not transfer more than balance", async () => {
      const tx = token.transferFrom(signers[0].address,
        signers[1].address,
        ethers.utils.parseEther("500")
      );
      await expect(tx).to.be.revertedWith("ERC20: insufficient-balance");
    });

    it("can't transfer to zero address", async () => {
      const tx = token.transferFrom(signers[0].address,
        "0x0000000000000000000000000000000000000000",
        ethers.utils.parseEther("5")
      );
      await expect(tx).to.be.reverted;
    });

    it("can't transfer to token address", async () => {
      const tx = token.transferFrom(signers[0].address,
        token.address,
        ethers.utils.parseEther("5")
      );
      await expect(tx).to.be.reverted;
    });

    it("supply didn't change", async () => {
      expect(await token.callStatic.totalSupply()).to.equal(ethers.utils.parseEther("100"));
    });

  });

  describe("approve functionality", async () => {

    it("transfers successfully with allowance", async () => {
      await token.connect(signers[0]).approve(signers[1].address, ethers.utils.parseEther("5"));
      await token.connect(signers[1]).transferFrom(signers[0].address, signers[2].address, ethers.utils.parseEther("2"));
      expect(await token.balanceOf(signers[0].address)).to.be.eq(
        ethers.utils.parseEther("88")
      );
      expect(await token.balanceOf(signers[2].address)).to.be.eq(
        ethers.utils.parseEther("2")
      );
    });

    it("max allowance works", async () => {
      await token.connect(signers[2]).approve(signers[3].address, ethers.constants.MaxUint256);
      await token.connect(signers[3]).transferFrom(signers[2].address, signers[3].address, ethers.utils.parseEther("2"));
      expect(await token.balanceOf(signers[2].address)).to.be.eq(
        ethers.utils.parseEther("0")
      );
      expect(await token.balanceOf(signers[3].address)).to.be.eq(
        ethers.utils.parseEther("2")
      );
      expect(await token.allowance(signers[2].address, signers[3].address)).to.be.eq(
        ethers.constants.MaxUint256
      );
    });

    it("approve returns true", async () => {
      expect(await token.connect(signers[0]).callStatic.approve(signers[1].address, ethers.utils.parseEther("0"))).to.equal(true);
    });

    it("does not transfer more than allowed", async () => {
      const tx = token.connect(signers[1]).transferFrom(signers[0].address,
        signers[2].address,
        ethers.utils.parseEther("10")
      );
      await expect(tx).to.be.revertedWith("ERC20: insufficient-allowance");
    });

    it("does not transfer if not allowed", async () => {
      const tx = token.connect(signers[2]).transferFrom(signers[0].address,
        signers[1].address,
        ethers.utils.parseEther("10")
      );
      await expect(tx).to.be.revertedWith("ERC20: insufficient-allowance");
    });

    it("supply didn't change", async () => {
      expect(await token.callStatic.totalSupply()).to.equal(ethers.utils.parseEther("100"));
    });

  });

});
