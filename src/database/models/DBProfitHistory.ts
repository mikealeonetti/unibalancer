import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../common";

export class DBProfitHistory extends Model<InferAttributes<DBProfitHistory>, InferCreationAttributes<DBProfitHistory>> {
    declare positionId: string;
    declare token: string;
    declare amount: string;
    // createdAt can be undefined during creation
    declare createdAt: CreationOptional<Date>;
    // updatedAt can be undefined during creation
    declare updatedAt: CreationOptional<Date>;
}

DBProfitHistory.init({
    positionId : {
        type: DataTypes.STRING,
        allowNull: false
    },
    token: {
        type: DataTypes.STRING,
        allowNull: false
    },
    amount: {
        type: DataTypes.STRING,
        allowNull: false
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
},
    {
        sequelize,
        tableName: "ProfitHistories"
    });
