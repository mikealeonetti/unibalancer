import { DataTypes } from "sequelize";
import { UmzugMigration } from "../common";


export const up: UmzugMigration = async function ({ context: queryInterface }) {
    // Start the transaction
    const transaction = await queryInterface.sequelize.transaction();

    try {
        // Pojitions
        await queryInterface.createTable("Positions", {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            positionId: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            outOfRangeSince: {
                type: DataTypes.DATE,
                allowNull: true
            },
            lastRewardsCollected: {
                type: DataTypes.DATE
            },
            previousPrice: {
                type: DataTypes.STRING,
                defaultValue: "0",
                allowNull: false
            },
            previousOwedFeesTokenA: {
                type: DataTypes.STRING,
                defaultValue: "0",
                allowNull: false
            },
            previousOwedFeesTokenB: {
                type: DataTypes.STRING,
                defaultValue: "0",
                allowNull: false
            },
            previousOwedFeesTotalUSDC: {
                type: DataTypes.STRING,
                defaultValue: "0",
                allowNull: false
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
            {
                transaction
            });

        // WhirlpoolHistories
        await queryInterface.createTable("PositionHistories", {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            positionId: {
                type: DataTypes.STRING,
                allowNull: false
            },
            closed: {
                type: DataTypes.DATE
            },
            totalSpentUSDC: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            totalSpentTokenA: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            totalSpentTokenB: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            receivedFeesTokenA: {
                type: DataTypes.STRING,
                defaultValue: "0",
            },
            receivedFeesTokenB: {
                type: DataTypes.STRING,
                defaultValue: "0"
            },
            enteredPriceUSDC: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            closedPriceUSDC: {
                type: DataTypes.STRING,
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
            {
                transaction
            });

        // Add the indexes
        await queryInterface.addIndex("PositionHistories", {
            unique: false,
            fields: ["positionId"],
            transaction
        });
        await queryInterface.addIndex("PositionHistories", {
            unique: false,
            fields: ["closed"],
            transaction
        });
        await queryInterface.addIndex("PositionHistories", {
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
        await queryInterface.dropTable("Positions");
        await queryInterface.dropTable("PositionHistories");

        await transaction.commit();
    }
    catch (e) {
        // Made an error so abort
        await transaction.rollback();
        // Rethrow
        throw e;
    }
}