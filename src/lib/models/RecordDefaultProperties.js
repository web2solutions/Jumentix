export default function (DataTypes) {
  return {
    // commom to all
    // user who has created/updated the document
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    // active flag
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    // delete flag
    deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    // version flag
    __v: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    // holds entire document change history
    _history: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      allowNull: false
    }
  }
}
