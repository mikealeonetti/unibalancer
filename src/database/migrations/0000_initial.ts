import { DataTypes } from "sequelize";
import { UmzugMigration } from "../common";


export const up: UmzugMigration = async function ({ context: queryInterface }) {
    // Start the transaction
    const transaction = await queryInterface.sequelize.transaction();

    try {
        // Create the properties
        await queryInterface.createTable("Properties", {
            id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
            key: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            value: {
                type: DataTypes.STRING,
                allowNull: false
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
            {
                transaction
            });

        // Create the telgrafs
        await queryInterface.createTable("Telegrafs", {
            id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
            chatID: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: true
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
        await queryInterface.dropTable("Properties");
        await queryInterface.dropTable("Telegrafs");

        await transaction.commit();
    }
    catch (e) {
        // Made an error so abort
        await transaction.rollback();
        // Rethrow
        throw e;
    }
}