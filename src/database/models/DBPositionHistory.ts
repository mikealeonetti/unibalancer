import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from "sequelize";
import { sequelize } from "../common";

export class DBPositionHistory extends Model<InferAttributes<DBPositionHistory>, InferCreationAttributes<DBPositionHistory>> {
	declare positionId: string;
	declare closed: Date | null;
	declare enteredPriceUSDC: string;
	declare closedPriceUSDC: string | null;
	declare receivedFeesTokenA: CreationOptional<string>;
	declare receivedFeesTokenB: CreationOptional<string>;
	// createdAt can be undefined during creation
	declare createdAt: CreationOptional<Date>;
	// updatedAt can be undefined during creation
	declare updatedAt: CreationOptional<Date>;

	declare liquidityAtOpen:string;
	declare liquidityAtClose:string|null;


	declare static getAverageTimeInPosition: ()=>Promise<number>;
	declare static getLatestByPositionIdString : ( positionId : string )=>Promise<DBPositionHistory|null>;
	declare static getLatestByPositionId : ( positionId : BigInt )=>Promise<DBPositionHistory|null>;
}

DBPositionHistory.getAverageTimeInPosition = async function() : Promise<number> {
	const average = await this.findOne({
		attributes: [
			[
				Sequelize.fn("avg",
					Sequelize.cast(
						Sequelize.literal(
							"( JulianDay(closed) - JulianDay(createdAt) ) * 24"
						), "Decimal")
				), "avg"
			]

		]
	});

	// If we have it return it
	if( average )
		return Number( average.get("avg") );

	// Otherwise zero
	return 0;
}

DBPositionHistory.getLatestByPositionIdString = function( positionId : string ) : Promise<DBPositionHistory|null> {
	return this.findOne({
		where: { positionId },
		order: [["createdAt", "DESC"]]
	});
};

DBPositionHistory.getLatestByPositionId = function( positionId : BigInt ) : Promise<DBPositionHistory|null> {
	return this.getLatestByPositionIdString( positionId.toString() );
};

DBPositionHistory.init({
	positionId: {
		type: DataTypes.STRING,
		allowNull: false
	},
	closed: {
		type: DataTypes.DATE
	},
	receivedFeesTokenA: {
		type: DataTypes.STRING,
		defaultValue: "0"
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
	liquidityAtOpen: {
		type: DataTypes.STRING,
		allowNull : false
	},
	liquidityAtClose: {
		type: DataTypes.STRING
	},
	createdAt: DataTypes.DATE,
	updatedAt: DataTypes.DATE,
},
	{
		sequelize,
		tableName: "PositionHistories",
	});