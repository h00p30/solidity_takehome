import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { MockProvider } from "ethereum-waffle";
import { ERC20 } from "../typechain/ERC20";
import { ERC20__factory } from "../typechain/factories/ERC20__factory";
import { Vault } from "../typechain/Vault";
import { Vault__factory } from "../typechain/factories/Vault__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

const { provider } = waffle;

async function increaseBlockTimestamp(provider: MockProvider, time: number) {
  await provider.send("evm_increaseTime", [time]);
  await provider.send("evm_mine", []);
};

describe("vault", function () {
  let token: ERC20;
  let vault: Vault;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];

  before(async function () {
    signers = await ethers.getSigners();
    const token_deployer = new ERC20__factory(signers[0]);
    token = await token_deployer.deploy("token", "TKN");
    const vault_deployer = new Vault__factory(signers[1]);
    vault = await vault_deployer.deploy();
    await token.mint(signers[1].address, ethers.utils.parseEther("100"));
    await token.mint(signers[3].address, ethers.utils.parseEther("100"));
  });

  describe("createGrant functionality", async () => {

    it("creates grant successfully", async () => {
      await token.connect(signers[1]).approve(vault.address, ethers.utils.parseEther("10"));
      await vault.connect(signers[1]).createGrant(ethers.utils.parseEther("2"), ethers.BigNumber.from("1657606008"), signers[2].address, token.address);

      const grant = await vault.countToGrant(0);

      expect(grant.recipient).to.be.eq(signers[2].address);
      expect(grant.amount).to.be.eq(ethers.utils.parseEther("2"));
      expect(grant.unlockTimestamp).to.be.eq(1657606008);
      expect(grant.token).to.be.eq(token.address);
      expect(grant.active).to.be.eq(true);
    });

    it("creates grant successfully with an old timestamp", async () => {
      await vault.connect(signers[1]).createGrant(ethers.utils.parseEther("3"), ethers.BigNumber.from("1655606008"), signers[2].address, token.address);

      const grant = await vault.countToGrant(1);

      expect(grant.recipient).to.be.eq(signers[2].address);
      expect(grant.amount).to.be.eq(ethers.utils.parseEther("3"));
      expect(grant.unlockTimestamp).to.be.eq(1655606008);
      expect(grant.token).to.be.eq(token.address);
      expect(grant.active).to.be.eq(true);
    });

    it("transfers tokens successfully", async () => {
      const addr1Balance = await token.balanceOf(signers[1].address);
      const vaultBalance = await token.balanceOf(vault.address);

      expect(addr1Balance).to.be.eq(ethers.utils.parseEther("95"));
      expect(vaultBalance).to.be.eq(ethers.utils.parseEther("5"));
    });

    it("only owner can create grants", async () => {
      await token.connect(signers[3]).approve(vault.address, ethers.utils.parseEther("10"));
      const tx = vault.connect(signers[3]).createGrant(ethers.utils.parseEther("2"), ethers.BigNumber.from("1657606008"), signers[2].address, token.address);

      await expect(tx).to.be.revertedWith("Not owner");
    });

    it("vault address can't be the recipient", async () => {
      const tx = vault.connect(signers[1]).createGrant(ethers.utils.parseEther("2"), ethers.BigNumber.from("1657606008"), vault.address, token.address);

      await expect(tx).to.be.revertedWith("This contract cannot be the recipient");
    });

    it("can't create grant with invalid token amount", async () => {
      const tx = vault.connect(signers[1]).createGrant(ethers.utils.parseEther("20"), ethers.BigNumber.from("1657606008"), signers[2].address, token.address);

      await expect(tx).to.be.revertedWith("ERC20: insufficient-allowance");
    });

    it("grantCount is incremented", async () => {
      expect(await vault.grantCount()).to.equal(2);
    });

  });

  describe("withdrawGrant functionality", async () => {

    it("can't withdraw grant before unlockTimestamp", async () => {
      const tx = vault.connect(signers[2]).withdrawGrant(0);

      await expect(tx).to.be.revertedWith("Cannot withdraw");
    });

    it("only recipient address can withdraw grant", async () => {
      const tx = vault.connect(signers[0]).withdrawGrant(0);

      await expect(tx).to.be.revertedWith("Not recipient address");
    });

    it("withdraws grant successfully", async () => {
      increaseBlockTimestamp(provider, 1000000)
      await vault.connect(signers[2]).withdrawGrant(0);

      const grant = await vault.countToGrant(0);

      expect(grant.active).to.be.eq(false);
    });

    it("transfers tokens successfully", async () => {
      const addr2Balance = await token.balanceOf(signers[2].address);
      const vaultBalance = await token.balanceOf(vault.address);

      expect(addr2Balance).to.be.eq(ethers.utils.parseEther("2"));
      expect(vaultBalance).to.be.eq(ethers.utils.parseEther("3"));
    });

  });

  describe("cancelGrant functionality", async () => {

    it("only owner can cancel a grant", async () => {
      const tx = vault.connect(signers[0]).cancelGrant(1);

      await expect(tx).to.be.revertedWith("Not owner");
    });

    it("can't cancel used grant", async () => {
      const tx = vault.connect(signers[1]).cancelGrant(0);
      const grant = await vault.countToGrant(0);

      await expect(tx).to.be.revertedWith("Cannot cancel after unlock");
      expect(grant.active).to.be.eq(false);
    });

    it("can't cancel grant after unlockTimestamp", async () => {
      const tx = vault.connect(signers[1]).cancelGrant(1);
      const grant = await vault.countToGrant(1);

      await expect(tx).to.be.revertedWith("Cannot cancel after unlock");
      expect(grant.active).to.be.eq(true);
    });

    it("cancels grant successfully", async () => {
      await vault.connect(signers[1]).createGrant(ethers.utils.parseEther("3"), ethers.BigNumber.from("1659606008"), signers[2].address, token.address);
      await vault.connect(signers[1]).cancelGrant(2);

      const grant = await vault.countToGrant(2);

      expect(grant.active).to.be.eq(false);
    });

    it("transfers back tokens successfully", async () => {
      const addr1Balance = await token.balanceOf(signers[1].address);
      const vaultBalance = await token.balanceOf(vault.address);

      expect(addr1Balance).to.be.eq(ethers.utils.parseEther("95"));
      expect(vaultBalance).to.be.eq(ethers.utils.parseEther("3"));
    });

  });

});