import { DataTypes } from "sequelize";
import { UmzugMigration } from "../common";


export const up: UmzugMigration = async function ({ context: queryInterface }) {
    // Start the transaction
    const transaction = await queryInterface.sequelize.transaction();

    try {
        // Create the telgrafs
        await queryInterface.createTable("Balances", {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            tokenA: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            tokenB: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            price: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            totalUsdc: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
            {
                transaction
            });

        await queryInterface.addIndex("Balances", {
            unique: false,
            fields: ["createdAt"],
            transaction
        });

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
        await queryInterface.dropTable("Balances");

        await transaction.commit();
    }
    catch (e) {
        // Made an error so abort
        await transaction.rollback();
        // Rethrow
        throw e;
    }
}