import Decimal from "decimal.js";
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../common";
import { toUpper } from "lodash";
import { DBDeficitHistory } from "./DBDeficitHistory";

import Debug from 'debug';
import { DBProfitHistory } from "./DBProfitHistory";

const debug = Debug("unibalancer:models:DBProperty");

enum KeyType {
	Current,
	Cumulative
}

const CURRENT_DEFICIT_KEY = "CurrentDeficit";
const CUMULATIVE_DEFICIT_KEY = "CumulativeDeficit";
const CURRENT_TOKEN_HOLDINGS_KEY = "CurrentHoldings";
const CUMULATIVE_TOKEN_HOLDINGS_KEY = "CumulativeHoldings";

// order of InferAttributes & InferCreationAttributes is important.
export class DBProperty extends Model<InferAttributes<DBProperty>, InferCreationAttributes<DBProperty>> {
	declare key: string;
	declare value: string;
	// createdAt can be undefined during creation
	declare createdAt: CreationOptional<Date>;
	// updatedAt can be undefined during creation
	declare updatedAt: CreationOptional<Date>;

	declare static getByKey: (key: string) => Promise<DBProperty | null>;
	declare static addDeficits: (currencySymbol: string, feeAmount: Decimal, reason: string) => Promise<DBProperty>;
	declare static getDeficits: (currencySymbol: string) => Promise<Decimal>;
	declare static paybackDeficits: (currencySymbol: string, credits: Decimal) => Promise<Decimal>;
	declare static getCurrentDeficitKeyFromSymbol: (currencySymbol: string) => string;
	declare static getCumulativeDeficitKeyFromSymbol: (currencySymbol: string) => string;
	declare static getTokenHoldingsKeyFromSymbol: (currencySymbol: string, keyType: KeyType) => string;
	declare static getTokenHoldings: (currencySymbol: string) => Promise<Decimal>;
	declare static addTokenHoldings: (currencySymbol: string, amount: Decimal, positionId: string) => Promise<void>;
}


DBProperty.getTokenHoldingsKeyFromSymbol = function (currenySymbol: string, keyType: KeyType) {
	if (keyType == KeyType.Cumulative)
		return CUMULATIVE_TOKEN_HOLDINGS_KEY + "-" + toUpper(currenySymbol);

	return CURRENT_TOKEN_HOLDINGS_KEY + "-" + toUpper(currenySymbol);
}

DBProperty.getTokenHoldings = async function(currencySymbol: string): Promise<Decimal> {
	// The key
	const key = DBProperty.getTokenHoldingsKeyFromSymbol(currencySymbol, KeyType.Current);

	// Get the previous value
	let property = await DBProperty.getByKey(key);

	// Do we have a property already?
	if (property) {
		// Return the value
		return new Decimal(property.value);
	}

	// Return zero
	return new Decimal(0);
};

DBProperty.addTokenHoldings = async function(currencySymbol: string, amount: Decimal, positionId: string): Promise<void> {
	// Makes no sense to increment
	if (amount.lte(0))
		return;

	// The key
	const currentKey = DBProperty.getTokenHoldingsKeyFromSymbol(currencySymbol, KeyType.Current);
	const cumulativeKey = DBProperty.getTokenHoldingsKeyFromSymbol(currencySymbol, KeyType.Cumulative);

	// Get the previous value
	let [
		currentHoldings,
		cumulativeHoldings
	] = await Promise.all([
		DBProperty.getByKey(currentKey),
		DBProperty.getByKey(cumulativeKey),
	]);

	// Do we have a property already?
	if (currentHoldings) {
		// In crement
		currentHoldings.value = new Decimal(currentHoldings.value).plus(amount).toString();
	}
	else {
		// Create
		currentHoldings = new DBProperty({
			key: currentKey,
			value: amount.toString()
		});
	}

	if (cumulativeHoldings == null)
		cumulativeHoldings = new DBProperty({ key: cumulativeKey, value: amount.toString() });
	else
		cumulativeHoldings.value = amount.add(cumulativeHoldings.value).toString();

	// Also add a profit history
	const profitHistoryPromise = DBProfitHistory.create({
		positionId,
		token : toUpper( currencySymbol ), 
		amount : amount.toString()
	});

	// Save it
	await Promise.all([currentHoldings.save(), cumulativeHoldings.save(), profitHistoryPromise]);
};

DBProperty.getByKey = function (key: string): Promise<DBProperty | null> {
	return this.findOne({ where: { key } });
};

DBProperty.getCurrentDeficitKeyFromSymbol = function (currencyName: string) {
	return CURRENT_DEFICIT_KEY + "-" + toUpper(currencyName);
};
DBProperty.getCumulativeDeficitKeyFromSymbol = function (currencyName: string) {
	return CUMULATIVE_DEFICIT_KEY + "-" + toUpper(currencyName);
};

DBProperty.paybackDeficits = async function (currencySymbol: string, credits: Decimal): Promise<Decimal> {
	// Get the key
	const key = this.getCurrentDeficitKeyFromSymbol(currencySymbol);

	// Current deficits in decimal
	let currentDeficits = new Decimal(0);

	// Get the fee
	let deficits = await this.getByKey(key);

	// Get the deficits
	if (deficits != null)
		currentDeficits = new Decimal(deficits.value);
	else
		deficits = new DBProperty({ key, value: '0' });

	// Get the leftover credits
	const deficitsAfter = currentDeficits.minus(credits);
	const creditsAfter = credits.minus(currentDeficits);

	debug("deficitsAfter=%s, creditsAfter=%s", deficitsAfter, creditsAfter);

	// Save the deficits
	deficits.value = Decimal.max(0, deficitsAfter).toString(); // Can't be less than 
	await deficits.save();

	// Return the credits
	return Decimal.max(0, creditsAfter);
};

DBProperty.addDeficits = async function (currencySymbol: string, feeAmount: Decimal, reason: string): Promise<DBProperty> {
	const currentKey = this.getCurrentDeficitKeyFromSymbol(currencySymbol);
	const cumulativeKey = this.getCumulativeDeficitKeyFromSymbol(currencySymbol);

	// Get the fee
	let [deficits, cumulativeDeficits] = await Promise.all([
		this.getByKey(currentKey),
		this.getByKey(cumulativeKey)
	]);

	if (deficits == null)
		deficits = new DBProperty({ key: currentKey, value: feeAmount.toString() });
	else
		deficits.value = feeAmount.add(deficits.value).toString();

	if (cumulativeDeficits == null)
		cumulativeDeficits = new DBProperty({ key: cumulativeKey, value: feeAmount.toString() });
	else
		cumulativeDeficits.value = feeAmount.add(cumulativeDeficits.value).toString();

	const deficitHistoryPromise = await DBDeficitHistory.create({
		token: toUpper( currencySymbol ),
		amount: feeAmount.toString(),
		reason
	});

	// Save it
	await Promise.all([deficits.save(), cumulativeDeficits.save(), deficitHistoryPromise]);

	return deficits;
};

DBProperty.getDeficits = async function (currencyName: string): Promise<Decimal> {
	const key = this.getCurrentDeficitKeyFromSymbol(currencyName);


	// Get the fee
	const deficits = await this.getByKey(key);

	if (deficits == null)
		return new Decimal(0);

	return new Decimal(deficits.value);
};

DBProperty.init({
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
		sequelize,
		tableName: "Properties"
	});
