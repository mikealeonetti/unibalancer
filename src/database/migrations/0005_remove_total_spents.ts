import { DataTypes } from "sequelize";
import { UmzugMigration } from "../common";

const removeFields = [
    "totalSpentUSDC",
    "totalSpentTokenA",
    "totalSpentTokenB"
];

export const up: UmzugMigration = async function ({ context: queryInterface }) {
    // Start the transaction
    const transaction = await queryInterface.sequelize.transaction();

    try {
        for (const removeField of removeFields)
            await queryInterface.removeColumn("PositionHistories", removeField, { transaction });

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
        // Add them back
        for (const removeField of removeFields) {
            await queryInterface.addColumn("PositionHistories",
                removeField,
                {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                { transaction }
            );
        }

        await transaction.commit();
    }
    catch (e) {
        // Made an error so abort
        await transaction.rollback();
        // Rethrow
        throw e;
    }
}