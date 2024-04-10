import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../common";

export class DBPosition extends Model<InferAttributes<DBPosition>, InferCreationAttributes<DBPosition>> {
	declare positionId: string;
	declare outOfRangeSince: Date | null;
	declare lastRewardsCollected: Date | null;
	// createdAt can be undefined during creation
	declare createdAt: CreationOptional<Date>;
	// updatedAt can be undefined during creation
	declare updatedAt: CreationOptional<Date>;
	declare previousPrice: CreationOptional<string>;
	declare previousOwedFeesTokenA: CreationOptional<string>;
	declare previousOwedFeesTokenB: CreationOptional<string>;
	declare previousOwedFeesTotalUSDC: CreationOptional<string>;
	declare redepositAttemptsRemaining : CreationOptional<number>;

	declare static getByPositionIdString: (positionId: string) => Promise<DBPosition | null>;
	declare static getByPositionId: (positionId: BigInt) => Promise<DBPosition | null>;
}

DBPosition.getByPositionIdString = function (positionId: string): Promise<DBPosition | null> {
	return this.findOne({
		where: { positionId }
	});
};

DBPosition.getByPositionId = function (positionId: BigInt): Promise<DBPosition | null> {
	return this.getByPositionIdString(positionId.toString());
};

DBPosition.init({
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
	redepositAttemptsRemaining: {
		type: DataTypes.INTEGER,
		defaultValue: 0,
		allowNull: false
	},
	createdAt: DataTypes.DATE,
	updatedAt: DataTypes.DATE,
},
	{
		sequelize,
		tableName: "Positions"
	});