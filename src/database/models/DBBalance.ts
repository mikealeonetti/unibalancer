import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../common";

export class DBBalance extends Model<InferAttributes<DBBalance>, InferCreationAttributes<DBBalance>> {
    declare tokenA: string;
    declare tokenB: string;
    declare price: string;
    declare totalUsdc: string;
    // createdAt can be undefined during creation
    declare createdAt: CreationOptional<Date>;
    // updatedAt can be undefined during creation
    declare updatedAt: CreationOptional<Date>;
}

DBBalance.init({
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
        sequelize,
        tableName: "Balances"
    });
