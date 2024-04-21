import { DataTypes } from "sequelize";
import { UmzugMigration } from "../common";

export const up: UmzugMigration = async function ({ context: queryInterface }) {
    // Start the transaction
    const transaction = await queryInterface.sequelize.transaction();

    try {

        await queryInterface.addColumn("Stats",
            "totalLiquidity",
            {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue : 0
            },
            { transaction }
        );

        // Commit it
        await transaction.commit();
    }
    catch (e) {
        // Made an error so abort
        await transaction.rollback();
        // Rethrow
        throw e;

    }
}

export const down: UmzugMigration = async function ({ context: queryInterface }) {
    // Start the transaction
    const transaction = await queryInterface.sequelize.transaction();

    try {
        await queryInterface.removeColumn("Stats", "totalLiquidity", { transaction });
        await transaction.commit();
    }
    catch (e) {
        // Made an error so abort
        await transaction.rollback();
        // Rethrow
        throw e;
    }
}