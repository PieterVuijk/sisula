// Create a columnar split table
if(source.split == 'bulk') {
var part, term;
/*~
IF Object_ID('$source.qualified$_CreateRawSplitTables', 'P') IS NOT NULL
DROP PROCEDURE [$source.qualified$_CreateRawSplitTables];
GO

--------------------------------------------------------------------------
-- Procedure: $source.qualified$_CreateRawSplitTables
--
-- The split table is populated by a bulk insert with a format file that
-- split rows from the source file into columns.
--
~*/
while(part = source.nextPart()) {
/*~
-- Create: $part.qualified$_RawSplit
~*/
}
/*~
--
-- Generated: ${new Date()}$ by $VARIABLES.USERNAME
-- From: $VARIABLES.COMPUTERNAME in the $VARIABLES.USERDOMAIN domain
--------------------------------------------------------------------------
CREATE PROCEDURE [$source.qualified$_CreateRawSplitTables] (
    @agentJobId uniqueidentifier = null,
    @agentStepId smallint = null
)
AS
BEGIN
SET NOCOUNT ON;
~*/
beginMetadata(source.qualified + '_CreateRawSplitTables', source.name, 'Source');
var rowlength = source.rowlength ? source.rowlength : 'max';
while(part = source.nextPart()) {
/*~
    IF Object_ID('$part.qualified$_RawSplit', 'U') IS NOT NULL
    DROP TABLE [$part.qualified$_RawSplit];
    EXEC('
    CREATE TABLE [$part.qualified$_RawSplit] (
        _id int identity(1,1) not null,
        _file int not null default 0,
        _timestamp datetime2(2) not null default sysdatetime(),
~*/
    while(term = part.nextTerm()) {
/*~
        [$term.name$] $(source.datafiletype == 'char')? varchar($rowlength), : nvarchar($rowlength),
~*/
    }
/*~
        constraint [pk$part.qualified$_RawSplit] primary key(
            _id asc
        )
    )
    ');
~*/
}
endMetadata();
/*~
END
GO
~*/
}
