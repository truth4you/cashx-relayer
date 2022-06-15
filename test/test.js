const { deploy } = require("../scripts/utils")

describe("Test total", () => {
    it("Deploy ERC", async () => {
        await deploy("BEP20Token")
    })
})