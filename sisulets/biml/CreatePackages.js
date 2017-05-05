// Create loading logic
var load, map, sql, i;
/*~
<Biml xmlns="http://schemas.varigence.com/biml.xsd">
    <Connections>
        <OleDbConnection Name="$VARIABLES.SourceDatabase" ConnectionString="Server=$VARIABLES.SourceServer;Initial Catalog=$VARIABLES.SourceDatabase;Integrated Security=SSPI;Provider=SQLNCLI11;" />
        <OleDbConnection Name="$VARIABLES.TargetDatabase" ConnectionString="Server=$VARIABLES.TargetServer;Initial Catalog=$VARIABLES.TargetDatabase;Integrated Security=SSPI;Provider=SQLNCLI11;" />
    </Connections>
    <Packages>
~*/
while(load = target.nextLoad()) {
/*~
        <Package Name="$load.qualified" ConstraintMode="Linear" ProtectionLevel="EncryptSensitiveWithUserKey">
            <Tasks>
~*/
    if(sql = load.sql ? load.sql.before : null) {
/*~
                <ExecuteSQL Name="SQL Before" ConnectionName="$VARIABLES.SourceDatabase">
                    <DirectInput>$sql._sql</DirectInput>
                </ExecuteSQL>
~*/
    }
    var naturalKeys = [], 
        surrogateKeys = [], 
        metadata = [],
        others = [];
    
    while(map = load.nextMap()) {
        switch (map.as) {
            case 'natural key':
                naturalKeys.push(map);
                break;
            case 'surrogate key':
                surrogateKeys.push(map);
                break;
            case 'metadata':
                metadata.push(map);
                break;
            default:
                others.push(map);
        }
    }    

    var attributeMappings = [];
    var historizedAttributesExist = false;
    var knottedAttributesExist = false;
    if(load.toAnchor()) {
        while(map = load.nextMap()) {
            if(map.knot) knottedAttributesExist = true;
            if(map.isValueColumn()) {
                var otherMap;
                var attributeMnemonic = map.target.match(/^(..\_...)\_.*/)[1];
                for(i = 0; otherMap = others[i]; i++) {
                    if(otherMap.target == attributeMnemonic + '_ChangedAt') {
                        map.isHistorized = true;
                        historizedAttributesExist = true;
                    }
                }
                attributeMappings.push(map);
            }
        }
    }

    if(attributeMappings.length > 0) {
/*~
                <ExecuteSQL Name="Disable triggers and constraints" ConnectionName="$VARIABLES.TargetDatabase">
                    <DirectInput>
~*/
        for(i = 0; map = attributeMappings[i]; i++) {
/*~
                    DISABLE TRIGGER ALL ON [${VARIABLES.TargetSchema}$].[${map.attribute}$];
                    ALTER TABLE [${VARIABLES.TargetSchema}$].[${map.attribute}$] NOCHECK CONSTRAINT ALL;
~*/
        }
/*~
                    </DirectInput>
                </ExecuteSQL>
~*/        
    }

    var commaStr = ',',
        andStr = 'AND';

    var loadingSQL = load._load ? load._load : "SELECT * FROM " + load.source;

    if(knottedAttributesExist) {
/*~
                <Dataflow Name="Load knots">
                    <Transformations>
                        <OleDbSource Name="$load.source" ConnectionName="$VARIABLES.SourceDatabase">
                            <DirectInput>$loadingSQL</DirectInput>
                        </OleDbSource>
                        <Multicast Name="Split">
                            <OutputPaths> 
~*/
        for(i = 0; map = attributeMappings[i]; i++) {
            if(map.knot) {
/*~
                                <OutputPath Name="$map.knot"/> 
~*/
            }
        }
/*~
                            </OutputPaths>
                        </Multicast>
~*/
        for(i = 0; map = attributeMappings[i]; i++) {
            if(map.knot) {
                var knotMnemonic = map.knot.match(/^(...)\_.*/)[1];
/*~
                        <ConditionalSplit Name="${map.knot}$__not_Null">
                            <OutputPaths>
                                <OutputPath Name="Values">
                                    <Expression>!ISNULL([$map.source])</Expression>
                                </OutputPath>
                            </OutputPaths>
                            <InputPath OutputPathName="Split.$map.knot" />
                        </ConditionalSplit>
                        <Aggregate Name="${map.knot}$__Unique">
                            <InputPath OutputPathName="${map.knot}$__not_Null.Values" />
                            <OutputPaths>
                                <OutputPath Name="Values">
                                    <Columns>
                                        <Column Operation="GroupBy" SourceColumn="$map.source" />
~*/
                if(metadata[0]) {
/*~
                                        <Column Operation="Minimum" SourceColumn="${metadata[0].source}$" />
~*/                                                        
                }
/*~                                
                                    </Columns>
                                </OutputPath>
                            </OutputPaths>
                        </Aggregate>
                        <Lookup Name="${map.knot}$__Lookup" NoMatchBehavior="RedirectRowsToNoMatchOutput" CacheMode="Partial" OleDbConnectionName="$VARIABLES.TargetDatabase">
                            <ExternalTableInput Table="[$VARIABLES.TargetSchema].[${map.knot}$]" />
                            <Inputs>
                                <Column SourceColumn="$map.source" TargetColumn="$map.knot" />
                            </Inputs>
                            <InputPath OutputPathName="${map.knot}$__Unique.Values" />
                        </Lookup>
                        <OleDbDestination Name="${map.knot}$" ConnectionName="$VARIABLES.TargetDatabase" CheckConstraints="false" UseFastLoadIfAvailable="true" TableLock="false">
                            <ErrorHandling ErrorRowDisposition="FailComponent" TruncationRowDisposition="FailComponent" />
                            <ExternalTableOutput Table="[${VARIABLES.TargetSchema}$].[${map.knot}$]" />
                            <InputPath OutputPathName="${map.knot}$__Lookup.NoMatch" />
                            <Columns>
                                <Column SourceColumn="$map.source" TargetColumn="$map.knot" />
~*/
                if(metadata[0]) {
/*~
                                <Column SourceColumn="${metadata[0].source}$" TargetColumn="Metadata_${knotMnemonic}$" />
~*/                                                        
                }
/*~                                
                            </Columns>
                        </OleDbDestination>
~*/
            }
        }
/*~
                    </Transformations>
                </Dataflow>
~*/        
    } // if knotted attributes exist
/*~
                <Dataflow Name="Load data">
                    <Transformations>
~*/
    if(naturalKeys.length == 0 && surrogateKeys.length == 0) {
/*~
                        <OleDbSource Name="$load.source" ConnectionName="$VARIABLES.SourceDatabase">
                            <DirectInput>$loadingSQL</DirectInput>
                        </OleDbSource>
~*/
    }
    else if(naturalKeys.length > 0 && load.toAnchor()) {
/*~
                        <OleDbSource Name="$load.source" ConnectionName="$VARIABLES.SourceDatabase">
                            <DirectInput>
                                DECLARE @known INT = 0;
                                MERGE [${VARIABLES.TargetDatabase}$].[${VARIABLES.TargetSchema}$].[${load.targetTable}$] [${load.anchorMnemonic}$]
                                USING (
                                    SELECT
                                        l.${load.anchorMnemonic}$_ID,
~*/
        while(map = load.nextMap()) {
            commaStr = load.hasMoreMaps() ? ',' : '';
/*~
                                        t.${map.source + commaStr}$
~*/
        }
/*~
                                    FROM (
                                        $loadingSQL
                                    ) t
                                    LEFT JOIN
                                        [${VARIABLES.TargetDatabase}$].[${VARIABLES.TargetSchema}$].[${load.target}$] l WITH (NOLOCK)
                                    ON
~*/
        for(i = 0; map = naturalKeys[i]; i++) {
            andStr = naturalKeys[i+1] ? 'AND' : '';
/*~            
                                        t.$map.source = l.$map.target $andStr
~*/
        }
/*~
                                ) src
                                ON
                                    src.${load.anchorMnemonic}$_ID = [${load.anchorMnemonic}$].${load.anchorMnemonic}$_ID
~*/
        if(metadata[0]) {
/*~                                    
                                WHEN NOT MATCHED THEN 
                                INSERT ( Metadata_${load.anchorMnemonic}$ )
                                VALUES ( src.${metadata[0].source}$ )
~*/
        }
        else {
/*~                                    
                                WHEN NOT MATCHED THEN 
                                INSERT ( ${load.anchorMnemonic}$_Dummy )
                                VALUES ( null )
~*/            
        }
/*~
                                WHEN MATCHED THEN 
                                UPDATE SET @known = @known + 1
                                OUTPUT
                                    isnull(src.${load.anchorMnemonic}$_ID, inserted.${load.anchorMnemonic}$_ID) as ${load.anchorMnemonic}$_ID,
~*/
        var uniqueSourceColumns = [];
        while(map = load.nextMap()) {
            if(uniqueSourceColumns.indexOf(map.source) < 0) {
                uniqueSourceColumns.push(map.source);
/*~
                                    src.$map.source,
~*/
            }
        }
        if(metadata[0]) {
/*~
                                    ${metadata[0].source}$,
~*/            
        }
/*~                                    
                                    left($$action, 1) as __Operation;
                            </DirectInput>
                        </OleDbSource>
~*/
    }
    else if(surrogateKeys.length > 0 && load.toAnchor()) {
/*~
                        <OleDbSource Name="$load.source" ConnectionName="$VARIABLES.SourceDatabase">
                            <DirectInput>
                                DECLARE @known INT = 0;
                                MERGE [${VARIABLES.TargetDatabase}$].[${VARIABLES.TargetSchema}$].[${load.targetTable}$] [${load.anchorMnemonic}$]
                                USING (
                                    $loadingSQL
                                ) src
                                ON
                                    src.${surrogateKeys[0].source}$ = [${load.anchorMnemonic}$].${surrogateKeys[0].target}$
~*/
        if(metadata[0]) {
/*~                                    
                                WHEN NOT MATCHED THEN 
                                INSERT ( Metadata_${load.anchorMnemonic}$ )
                                VALUES ( src.${metadata[0].source}$ )
~*/
        }
        else {
/*~                                    
                                WHEN NOT MATCHED THEN 
                                INSERT ( ${load.anchorMnemonic}$_Dummy )
                                VALUES ( null )
~*/            
        }
/*~
                                WHEN MATCHED THEN 
                                UPDATE SET @known = @known + 1
                                OUTPUT
                                    isnull(src.${surrogateKeys[0].source}$, inserted.${load.anchorMnemonic}$_ID) as ${load.anchorMnemonic}$_ID,
~*/
        var uniqueSourceColumns = [];
        while(map = load.nextMap()) {
            if(uniqueSourceColumns.indexOf(map.source) < 0 && surrogateKeys.indexOf(map) < 0) {
                uniqueSourceColumns.push(map.source);
/*~
                                    src.$map.source,
~*/
            }
        }
        if(metadata[0]) {
/*~
                                    ${metadata[0].source}$,
~*/            
        }
/*~
                                    left($$action, 1) as __Operation;
                            </DirectInput>
                        </OleDbSource>
~*/        
    }

    if(attributeMappings.length > 0) {
/*~                       
                        <ConditionalSplit Name="Known_Unknown">
                            <OutputPaths>
                                <OutputPath Name="Known">
                                    <Expression>[__Operation]=="U"</Expression>
                                </OutputPath>
                                <OutputPath Name="Unknown">
                                    <Expression>[__Operation]=="I"</Expression>
                                </OutputPath>
                            </OutputPaths>
                        </ConditionalSplit>
~*/
        if(historizedAttributesExist) {
/*~                        
                        <Multicast Name="Split_Known">
                            <OutputPaths> 
~*/
            for(i = 0; map = attributeMappings[i]; i++) {
                if(map.isHistorized) {
/*~
                                <OutputPath Name="$map.attribute"/> 
~*/
                }
            }
/*~
                            </OutputPaths>
                            <InputPath OutputPathName="Known_Unknown.Known" />
                        </Multicast>
~*/
            for(i = 0; map = attributeMappings[i]; i++) {
                if(map.isHistorized) {
                    var attributeMnemonic = map.target.match(/^(..\_...)\_.*/)[1];
                    var inputPath = 'Split_Known.' + map.attribute;
                    var source = map.source;
                    var target = map.target;
                    if(map.knot) {
                        var knotMnemonic = map.knot.match(/^(...)\_.*/)[1];
/*~
                        <Lookup Name="${map.attribute}$__Known_Lookup" NoMatchBehavior="FailComponent" CacheMode="Partial" OleDbConnectionName="$VARIABLES.TargetDatabase">
                            <ExternalTableInput Table="[$VARIABLES.TargetSchema].[${map.knot}$]" />
                            <Inputs>
                                <Column SourceColumn="$mapSource" TargetColumn="$map.knot" />
                            </Inputs>
                            <Outputs>
                                <Column SourceColumn="${knotMnemonic}$_ID" />
                            </Outputs>
                            <InputPath OutputPathName="$inputPath" />                            
                        </Lookup>
~*/                    
                        inputPath = map.attribute + '__Known_Lookup.Match';
                        mapSource = knotMnemonic + '_ID';
                        mapTarget = attributeMnemonic + '_' + knotMnemonic + '_ID';
                    }
/*~
                        <ConditionalSplit Name="${map.attribute}$__Known_not_Null">
                            <OutputPaths>
                                <OutputPath Name="Values">
                                    <Expression>!ISNULL([$mapSource])</Expression>
                                </OutputPath>
                            </OutputPaths>
                            <InputPath OutputPathName="$inputPath" />
                        </ConditionalSplit>
                        <OleDbDestination Name="${map.attribute}$__Known" ConnectionName="$VARIABLES.TargetDatabase" CheckConstraints="false" UseFastLoadIfAvailable="true" TableLock="false">
                            <ErrorHandling ErrorRowDisposition="IgnoreFailure" TruncationRowDisposition="FailComponent" />
                            <ExternalTableOutput Table="[${VARIABLES.TargetSchema}$].[${map.attribute}$]" />
                            <InputPath OutputPathName="${map.attribute}$__Known_not_Null.Values" />
                            <Columns>
                                <Column SourceColumn="${load.anchorMnemonic}$_ID" TargetColumn="${attributeMnemonic}$_${load.anchorMnemonic}$_ID" />
                                <Column SourceColumn="$mapSource" TargetColumn="$mapTarget" />
~*/
                    var attributeMap;
                    while(attributeMap = load.nextMap()) {
                        if(map != attributeMap && attributeMap.target.indexOf(attributeMnemonic) == 0) {
/*~
                                <Column SourceColumn="$attributeMap.source" TargetColumn="$attributeMap.target" />
~*/                            
                        }
                    }
                    if(metadata[0]) {
/*~
                                <Column SourceColumn="${metadata[0].source}$" TargetColumn="Metadata_${attributeMnemonic}$" />
~*/                                                        
                    }
/*~                                
                            </Columns>
                        </OleDbDestination>
~*/
                }
            }
        } // end of if historized attributes exist
/*~                        
                        <Multicast Name="Split_Unknown">
                            <OutputPaths> 
~*/
        for(i = 0; map = attributeMappings[i]; i++) {
/*~
                                <OutputPath Name="$map.attribute"/> 
~*/
        }
/*~
                            </OutputPaths>
                            <InputPath OutputPathName="Known_Unknown.Unknown" />
                        </Multicast>
~*/
        for(i = 0; map = attributeMappings[i]; i++) {
            var attributeMnemonic = map.target.match(/^(..\_...)\_.*/)[1];
            var inputPath = 'Split_Unknown.' + map.attribute;
            var mapSource = map.source;
            var mapTarget = map.target;
            if(map.knot) {
                var knotMnemonic = map.knot.match(/^(...)\_.*/)[1];
/*~
                        <Lookup Name="${map.attribute}$__Unknown_Lookup" NoMatchBehavior="FailComponent" CacheMode="Partial" OleDbConnectionName="$VARIABLES.TargetDatabase">
                            <ExternalTableInput Table="[$VARIABLES.TargetSchema].[${map.knot}$]" />
                            <Inputs>
                                <Column SourceColumn="$mapSource" TargetColumn="$map.knot" />
                            </Inputs>
                            <Outputs>
                                <Column SourceColumn="${knotMnemonic}$_ID" />
                            </Outputs>
                            <InputPath OutputPathName="$inputPath" />                            
                        </Lookup>
~*/                    
                inputPath = map.attribute + '__Unknown_Lookup.Match';
                mapSource = knotMnemonic + '_ID';
                mapTarget = attributeMnemonic + '_' + knotMnemonic + '_ID';
            }
/*~
                        <ConditionalSplit Name="${map.attribute}$__Unknown_not_Null">
                            <OutputPaths>
                                <OutputPath Name="Values">
                                    <Expression>!ISNULL([$mapSource])</Expression>
                                </OutputPath>
                            </OutputPaths>
                            <InputPath OutputPathName="$inputPath" />
                        </ConditionalSplit>
                        <OleDbDestination Name="${map.attribute}$__Unknown" ConnectionName="$VARIABLES.TargetDatabase" CheckConstraints="false" UseFastLoadIfAvailable="true" TableLock="false">
                            <ErrorHandling ErrorRowDisposition="FailComponent" TruncationRowDisposition="FailComponent" />
                            <ExternalTableOutput Table="[${VARIABLES.TargetSchema}$].[${map.attribute}$]" />
                            <InputPath OutputPathName="${map.attribute}$__Unknown_not_Null.Values" />
                            <Columns>
                                <Column SourceColumn="${load.anchorMnemonic}$_ID" TargetColumn="${attributeMnemonic}$_${load.anchorMnemonic}$_ID" />
                                <Column SourceColumn="$mapSource" TargetColumn="$mapTarget" />
~*/
            var attributeMap;
            while(attributeMap = load.nextMap()) {
                if(map != attributeMap && attributeMap.target.indexOf(attributeMnemonic) == 0) {
/*~
                                <Column SourceColumn="$attributeMap.source" TargetColumn="$attributeMap.target" />
~*/                            
                }
            }
            if(metadata[0]) {
/*~
                                <Column SourceColumn="${metadata[0].source}$" TargetColumn="Metadata_${attributeMnemonic}$" />
~*/                                                        
            }
/*~                                
                            </Columns>
                        </OleDbDestination>
~*/
        }
    } // end of if attributes exist
/*~
                    </Transformations>
                </Dataflow>
~*/
    if(attributeMappings.length > 0) {
/*~
                <ExecuteSQL Name="Enable triggers and constraints" ConnectionName="$VARIABLES.TargetDatabase">
                    <DirectInput>
~*/
        for(i = 0; map = attributeMappings[i]; i++) {
/*~
                    ENABLE TRIGGER ALL ON [${VARIABLES.TargetSchema}$].[${map.attribute}$];
                    ALTER TABLE [${VARIABLES.TargetSchema}$].[${map.attribute}$] WITH NOCHECK CHECK CONSTRAINT ALL;
~*/
        }
/*~
                    </DirectInput>
                </ExecuteSQL>
~*/        
    }
    if(sql = load.sql ? load.sql.after : null) {
/*~
                <ExecuteSQL Name="SQL After" ConnectionName="$VARIABLES.SourceDatabase">
                    <DirectInput>$sql._sql</DirectInput>
                </ExecuteSQL>
~*/
    }
/*~
            </Tasks>
        </Package>
~*/
}
/*~
    </Packages>
</Biml>
~*/