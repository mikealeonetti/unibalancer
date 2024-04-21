import { DataTypes, ModelAttributeColumnOptions } from "sequelize";
import { UmzugMigration } from "../common";

// How we'll rename the tables
const oldTableName = "Balances";
const newTableName = "Stats";

// Rename columns
const fieldsToRename = [
    ["tokenA", "tokenABalance"],
    ["tokenB", "tokenBBalance"],
    ["price", "tokenAPriceInUsdc"],
    ["totalUsdc", "totalUsdcBalance"]
];

const statsNewColumns = {
    "dailyPercentEma": {
        type: DataTypes.STRING,
        defaultValue: "0",
        allowNull: false
    },
    "profitTakenTokenA": {
        type: DataTypes.STRING,
        defaultValue: "0",
        allowNull: false
    },
    "profitTakenTokenB": {
        type: DataTypes.STRING,
        defaultValue: "0",
        allowNull: false
    },
    "feesReceivedTokenA": {
        type: DataTypes.STRING,
        defaultValue: "0",
        allowNull: false
    },
    "feesReceivedTokenB": {
        type: DataTypes.STRING,
        defaultValue: "0",
        allowNull: false
    },
    "totalPositions": {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    },
    "deficitsTokenA": {
        type: DataTypes.STRING,
        defaultValue: "0",
        allowNull: false
    },
    "deficitsTokenB": {
        type: DataTypes.STRING,
        defaultValue: "0",
        allowNull: false
    },
    "avgPositionTimeInHours": {
        type: DataTypes.NUMBER,
        defaultValue: "0",
        allowNull: false
    },
} as Record<string, ModelAttributeColumnOptions>;

export const up: UmzugMigration = async function ({ context: queryInterface }) {
    // Start the transaction
    const transaction = await queryInterface.sequelize.transaction();

    try {
        // Rename the table
        await queryInterface.renameTable(oldTableName, newTableName, { transaction });

        // Rename the balance fields
        for (const [oldName, newName] of fieldsToRename) {

            // Rename them all in bulk
            await queryInterface.renameColumn(newTableName, oldName, newName, { transaction });
        }

        // Loop all values
        for (const [field, attributes] of Object.entries(statsNewColumns)) {
            // Get the attributes
            // Add all the new columns
            await queryInterface.addColumn(newTableName, field, attributes, { transaction });
        }

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

        // Rename back all the old fields
        for (const [renameTo, renameFrom] of fieldsToRename) {
            // Do it NOW
            await queryInterface.renameColumn(newTableName, renameFrom, renameTo, { transaction });
        }

        // Remove all the beeps
        for (const [field] of Object.entries(statsNewColumns)) {
            await queryInterface.removeColumn(newTableName, field);
        }

        // Name the table back
        await queryInterface.renameTable(newTableName, oldTableName, { transaction });

        await transaction.commit();
    }
    catch (e) {
        // Made an error so abort
        await transaction.rollback();
        // Rethrow
        throw e;
    }
}