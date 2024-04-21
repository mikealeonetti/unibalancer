import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../common";

export class DBStat extends Model<InferAttributes<DBStat>, InferCreationAttributes<DBStat>> {
    declare tokenABalance: string;
    declare tokenBBalance: string;
    declare tokenAPriceInUsdc: string;
    declare totalUsdcBalance: string;
    declare dailyPercentEma: string;
    declare profitTakenTokenA: string;
    declare profitTakenTokenB: string;
    declare feesReceivedTokenA: string;
    declare feesReceivedTokenB: string;
    declare totalPositions: number;
    declare deficitsTokenA: string;
    declare deficitsTokenB: string;
    declare avgPositionTimeInHours: number;
    declare totalLiquidity : string;

    // createdAt can be undefined during creation
    declare createdAt: CreationOptional<Date>;
    // updatedAt can be undefined during creation
    declare updatedAt: CreationOptional<Date>;
}

DBStat.init({
    tokenABalance: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    tokenBBalance: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    tokenAPriceInUsdc: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    totalUsdcBalance: {
        type: DataTypes.STRING,
        allowNull: false,
    },
        dailyPercentEma: {
        type: DataTypes.STRING,
        allowNull: false
    },
    profitTakenTokenA: {
        type: DataTypes.STRING,
        allowNull: false
    },
    profitTakenTokenB: {
        type: DataTypes.STRING,
        allowNull: false
    },
    feesReceivedTokenA: {
        type: DataTypes.STRING,
        allowNull: false
    },
    feesReceivedTokenB: {
        type: DataTypes.STRING,
        allowNull: false
    },
    totalPositions: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    deficitsTokenA: {
        type: DataTypes.STRING,
        allowNull: false
    },
    deficitsTokenB: {
        type: DataTypes.STRING,
        allowNull: false
    },
    avgPositionTimeInHours: {
        type: DataTypes.DECIMAL,
        allowNull: false
    },
    totalLiquidity: {
        type: DataTypes.STRING,
        allowNull: false
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
},
    {
        sequelize,
        tableName: "Stats"
    });
