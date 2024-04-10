import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../common";

export class DBDeficitHistory extends Model<InferAttributes<DBDeficitHistory>, InferCreationAttributes<DBDeficitHistory>> {
    declare token: string;
    declare amount: string;
    declare reason: string;
    // createdAt can be undefined during creation
    declare createdAt: CreationOptional<Date>;
    // updatedAt can be undefined during creation
    declare updatedAt: CreationOptional<Date>;
}

DBDeficitHistory.init({
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
        sequelize,
        tableName: "DeficitHistories"
    });
