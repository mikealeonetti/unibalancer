import { DataTypes, Model, ModelAttributeColumnOptions } from "sequelize";
import { UmzugMigration } from "../common";

const newFields = [
    ["liquidityAtOpen", false],
    ["liquidityAtClose", true],
] as [string, boolean][];

export const up: UmzugMigration = async function ({ context: queryInterface }) {
    // Start the transaction
    const transaction = await queryInterface.sequelize.transaction();

    try {
        for (const [name, isNullable] of newFields) {
            const props : ModelAttributeColumnOptions<Model<any, any>> = {
                type: DataTypes.STRING
            };

            if(isNullable) {
                // Let it be null
                props.allowNull = true;
            }
            else {
                // We have to set this
                props.defaultValue = 0;
                props.allowNull = false;
            }

            await queryInterface.addColumn("PositionHistories",
                name,
                props,
                { transaction }
            );
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
        // Remove all new rows
        for(const [name] of newFields)
            await queryInterface.removeColumn("PositionHistories", name, { transaction });
        
        await transaction.commit();
    }
    catch (e) {
        // Made an error so abort
        await transaction.rollback();
        // Rethrow
        throw e;
    }
}