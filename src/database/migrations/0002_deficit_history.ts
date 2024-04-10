import { DataTypes } from "sequelize";
import { UmzugMigration } from "../common";


export const up: UmzugMigration = async function ({ context: queryInterface }) {
    // Start the transaction
    const transaction = await queryInterface.sequelize.transaction();

    try {
        // Create the telgrafs
        await queryInterface.createTable("DeficitHistories", {
            id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
            token: {
                type: DataTypes.STRING,
                allowNull: false
            },
            amount: {
                type: DataTypes.STRING,
                allowNull: false
            },
            reason: {
                type: DataTypes.STRING,
                allowNull: false
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
            {
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
        await queryInterface.dropTable("DeficitHistories");

        await transaction.commit();
    }
    catch (e) {
        // Made an error so abort
        await transaction.rollback();
        // Rethrow
        throw e;
    }
}