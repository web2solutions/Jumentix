"use strict";

const DataEntityName = "DemoProduct"

module.exports = {
    up: function(queryInterface, Sequelize) {
        return queryInterface
            .createTable( DataEntityName, {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false
                },

                product: {
                    type: Sequelize.STRING,
                    allowNull: false
                },
                description: {
                    type: Sequelize.STRING,
                    allowNull: false
                },
                price: {
                    type: Sequelize.STRING,
                    allowNull: false
                },

                // commom to all new tables
                createdAt: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.NOW
                },
                // date when document was updated
                updatedAt: {
                    type: Sequelize.DATE,
                    allowNull: true,
                    defaultValue: Sequelize.NOW
                },
                // user who has created/updated the document
                _writer_id: {
                    type : Sequelize.INTEGER,
                    allowNull: false
                },
                // active flag
                active: {
                    type : Sequelize.BOOLEAN,
                    defaultValue: true,
                    allowNull: false
                },
                // delete flag
                deleted: {
                    type : Sequelize.BOOLEAN,
                    defaultValue: false,
                    allowNull: false
                },
                // version flag
                __v: {
                    type : Sequelize.INTEGER,
                    defaultValue: 0,
                    allowNull: false
                },
                // holds entire document change history
                _history: {
                    type : Sequelize.TEXT,
                    defaultValue: '[]',
                    allowNull: false
                }
            });
    },

    down: function(queryInterface, Sequelize) {
        return queryInterface
            .dropTable(DataEntityName);
    }
};
